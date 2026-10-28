/**
 * @file postgres-journal-entry.repository.js
 *
 * PostgreSQL implementation of JournalEntryRepository.
 *
 * Responsibilities:
 * - Persist journal entries and lines atomically.
 * - Enforce tenant isolation on all reads and updates.
 * - Support tenant-scoped ID and idempotency lookups.
 * - Support row-level locking inside transactions.
 * - Calculate account balances from posted ledger entries.
 * - Update status and merge metadata safely.
 */

import db from "../../../../../cross-cutting/database/knex.js";
import JournalEntryMapper from "../mappers/journal-entry.mapper.js";

export class PostgresJournalEntryRepository {
    constructor({ uow, knex } = {}) {
        this.uow = uow;
        this.knex = knex ?? uow?.knex ?? db;
    }

    /**
     * Persist a journal entry and all its lines.
     * If the caller supplies a transaction, participate in it.
     * Otherwise, create a transaction to keep the writes atomic.
     */
    async save(aggregate, options = {}) {
        if (!aggregate) {
            throw new TypeError("Journal entry aggregate is required.");
        }

        const mapped = JournalEntryMapper.toPersistence(aggregate);

        if (!mapped?.entryRow) {
            throw new Error("Journal entry mapping did not produce an entry row.");
        }

        const { entryRow, lineRows = [] } = mapped;

        if (!Array.isArray(lineRows)) {
            throw new TypeError("Journal entry line rows must be an array.");
        }

        const tenantId = options.tenantId ?? entryRow.tenant_id;
        this.#requireTenantId(tenantId);

        if (
            entryRow.tenant_id != null &&
            String(entryRow.tenant_id) !== String(tenantId)
        ) {
            throw new Error(
                "Journal entry tenant does not match the requested tenant.",
            );
        }

        const entry = {
            ...entryRow,
            tenant_id: tenantId,
        };

        const lines = lineRows.map((line) => {
            if (
                line.tenant_id != null &&
                String(line.tenant_id) !== String(tenantId)
            ) {
                throw new Error(
                    "Journal line tenant does not match the journal entry tenant.",
                );
            }

            return {
                ...line,
                tenant_id: tenantId,
            };
        });

        const persist = async (client) => {
            await client("journal_entries").insert(entry);

            if (lines.length > 0) {
                await client("journal_lines").insert(lines);
            }
        };

        const transaction = this.#getTransaction(options);

        if (transaction) {
            await persist(transaction);
            return;
        }

        await this.knex.transaction(async (trx) => {
            await persist(trx);
        });
    }

    /**
     * Calculate the natural posted balance of an account.
     *
     * Uses integer minor units and the migrated ledger schema.
     * Does not calculate pending holds.
     *
     * @returns {Promise<{ postedBalance: string }>}
     */
    async calculateAccountBalance({
        tenantId,
        accountId,
        currency,
        asOfDate,
        accountType,
    }) {
        this.#requireTenantId(tenantId);
        this.#requireId(accountId, "Account ID");

        if (
            typeof currency !== "string" ||
            currency.trim() === ""
        ) {
            throw new TypeError("currency is required.");
        }

        const effectiveDate = new Date(asOfDate);

        if (
            asOfDate == null ||
            Number.isNaN(effectiveDate.getTime())
        ) {
            throw new TypeError("asOfDate must be a valid date.");
        }

        const normalizedType = String(accountType ?? "")
            .trim()
            .toUpperCase();

        const debitNormal = ["ASSET", "EXPENSE"].includes(
            normalizedType,
        );

        const creditNormal = [
            "LIABILITY",
            "EQUITY",
            "REVENUE",
        ].includes(normalizedType);

        if (!debitNormal && !creditNormal) {
            throw new TypeError(
                `Invalid account type: ${accountType}`,
            );
        }

        const result = await this.knex("ledger_entries as le")
            .join("ledger_journals as lj", function () {
                this.on("lj.id", "=", "le.journal_id")
                    .andOn("lj.tenant_id", "=", "le.tenant_id");
            })
            .where("le.tenant_id", tenantId)
            .where("lj.tenant_id", tenantId)
            .where("le.account_id", accountId)
            .where("le.currency", currency.trim().toUpperCase())
            .where("lj.currency", currency.trim().toUpperCase())
            .where("lj.posted_at", "<=", effectiveDate)
            .select(
                this.knex.raw(`
                    COALESCE(
                        SUM(
                            CASE
                                WHEN le.entry_type = 'DEBIT'
                                    THEN le.amount_minor
                                WHEN le.entry_type = 'CREDIT'
                                    THEN -le.amount_minor
                                ELSE 0
                            END
                        ),
                        0
                    )::text AS net_balance
                `),
            )
            .first();

        if (
            !result ||
            typeof result.net_balance !== "string" ||
            !/^-?\d+$/.test(result.net_balance)
        ) {
            throw new TypeError(
                "The database returned an invalid ledger balance.",
            );
        }

        const signedNet = BigInt(result.net_balance);

        return {
            postedBalance: (
                debitNormal ? signedNet : -signedNet
            ).toString(),
        };
    }

    /**
     * Find an entry by ID, scoped to its tenant.
     * Returns null if it does not exist for that tenant.
     */
    async findById(tenantId, id, options = {}) {
        this.#requireTenantId(tenantId);
        this.#requireId(id, "Journal entry ID");

        return this.#findEntryWithLines({
            tenantId,
            where: { id },
            options,
        });
    }

    /**
     * Find an entry using its tenant-scoped idempotency key.
     * Missing keys return null.
     */
    async findByIdempotencyKey(
        tenantId,
        idempotencyKey,
        options = {},
    ) {
        this.#requireTenantId(tenantId);

        if (
            idempotencyKey == null ||
            String(idempotencyKey).trim() === ""
        ) {
            return null;
        }

        const forUpdate = Boolean(options.forUpdate);

        if (forUpdate) {
            this.#requireTransaction(
                options,
                "Idempotency lookup with FOR UPDATE",
            );
        }

        return this.#findEntryWithLines({
            tenantId,
            where: { idempotency_key: idempotencyKey },
            options,
            forUpdate,
        });
    }

    /**
     * Find and lock a journal entry and its lines.
     * An active transaction is required for the locks to remain effective.
     */
    async findByIdForUpdate(tenantId, id, options = {}) {
        this.#requireTenantId(tenantId);
        this.#requireId(id, "Journal entry ID");
        this.#requireTransaction(options, "findByIdForUpdate");

        return this.#findEntryWithLines({
            tenantId,
            where: { id },
            options,
            forUpdate: true,
        });
    }

    /**
     * Update status and merge a metadata patch.
     * Returns the number of rows updated.
     */
    async updateStatus(
        tenantId,
        id,
        status,
        metadataPatch = {},
        options = {},
    ) {
        this.#requireTenantId(tenantId);
        this.#requireId(id, "Journal entry ID");

        if (status == null || String(status).trim() === "") {
            throw new Error("Journal entry status is required.");
        }

        if (
            metadataPatch == null ||
            typeof metadataPatch !== "object" ||
            Array.isArray(metadataPatch)
        ) {
            throw new TypeError("metadataPatch must be an object.");
        }

        const client = this.#getClient(options);

        return client("journal_entries")
            .where({
                tenant_id: tenantId,
                id,
            })
            .update({
                status,
                metadata: client.raw(
                    "COALESCE(metadata, '{}'::jsonb) || ?::jsonb",
                    [JSON.stringify(metadataPatch)],
                ),
                updated_at: new Date(),
            });
    }

    /**
     * Shared tenant-scoped lookup for an entry and its lines.
     */
    async #findEntryWithLines({
        tenantId,
        where,
        options = {},
        forUpdate = false,
    }) {
        this.#requireTenantId(tenantId);

        if (forUpdate) {
            this.#requireTransaction(
                options,
                "Journal entry lookup with FOR UPDATE",
            );
        }

        const client = this.#getClient(options);

        let entryQuery = client("journal_entries")
            .where({ tenant_id: tenantId })
            .where(where);

        if (forUpdate) {
            entryQuery = entryQuery.forUpdate();
        }

        const entry = await entryQuery.first();

        if (!entry) {
            return null;
        }

        let linesQuery = client("journal_lines")
            .where({
                tenant_id: tenantId,
                journal_entry_id: entry.id,
            })
            .orderBy("id");

        if (forUpdate) {
            linesQuery = linesQuery.forUpdate();
        }

        const lines = await linesQuery;

        return JournalEntryMapper.toDomain(entry, lines);
    }

    #getClient(options = {}) {
        return (
            options.transaction ??
            options.session ??
            this.knex
        );
    }

    #getTransaction(options = {}) {
        return options.transaction ?? options.session ?? null;
    }

    #requireTenantId(tenantId) {
        if (
            tenantId == null ||
            String(tenantId).trim() === ""
        ) {
            throw new Error("tenant_id is required.");
        }
    }

    #requireId(id, label) {
        if (id == null || String(id).trim() === "") {
            throw new Error(`${label} is required.`);
        }
    }

    #requireTransaction(options, operation) {
        if (!this.#getTransaction(options)) {
            throw new Error(
                `${operation} requires an active transaction.`,
            );
        }
    }
}
