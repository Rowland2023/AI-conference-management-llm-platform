
import db from "../../../../../cross-cutting/database/knex.js";
import AccountMapper from "../mappers/account.mapper.js";

export class PostgresAccountRepository {
  constructor({ uow, knex } = {}) {
    this.uow = uow;
    this.db = knex ?? db;
  }

  async save(accountAggregate, options = {}) {
    const client = this.#getClient(options);
    const row = AccountMapper.toPersistence(accountAggregate);

    const existing = await client("ledger_accounts")
      .where({
        id: row.id,
        tenant_id: row.tenant_id,
      })
      .first();

    if (existing) {
      await client("ledger_accounts")
        .where({
          id: row.id,
          tenant_id: row.tenant_id,
        })
        .update({
          name: row.name,
          currency: row.currency,
          is_active: row.is_active,
          updated_at: row.updated_at,
        });
    } else {
      await client("ledger_accounts").insert(row);
    }

    return AccountMapper.toDomain({
      ...row,
      ...(existing ?? {}),
      name: row.name,
      currency: row.currency,
      is_active: row.is_active,
      updated_at: row.updated_at,
    });
  }

  async findById(tenantId, accountId, options = {}) {
    this.#requireTenant(tenantId);

    const row = await this.#getClient(options)("ledger_accounts")
      .where({
        tenant_id: tenantId,
        id: accountId,
      })
      .first();

    return AccountMapper.toDomain(row);
  }

  async findByIdForUpdate(tenantId, accountId, options = {}) {
    this.#requireTenant(tenantId);

    const row = await this.#getTransaction(options)("ledger_accounts")
      .where({
        tenant_id: tenantId,
        id: accountId,
      })
      .forUpdate()
      .first();

    return AccountMapper.toDomain(row);
  }

  async findByIdsForUpdate(tenantId, accountIds = [], options = {}) {
    this.#requireTenant(tenantId);

    if (!Array.isArray(accountIds)) {
      throw new TypeError("accountIds must be an array.");
    }

    if (accountIds.length === 0) {
      return [];
    }

    const ids = [...new Set(accountIds)].sort();

    const rows = await this.#getTransaction(options)("ledger_accounts")
      .where("tenant_id", tenantId)
      .whereIn("id", ids)
      .orderBy("id", "asc")
      .forUpdate();

    return rows.map((row) => AccountMapper.toDomain(row));
  }

  async findByAccountNumber(accountNumber, options = {}) {
    const tenantId = options.tenantId;
    this.#requireTenant(tenantId);

    const row = await this.#getClient(options)("ledger_accounts")
      .where({
        tenant_id: tenantId,
        code: accountNumber,
      })
      .first();

    return AccountMapper.toDomain(row);
  }

  #getClient(options) {
    return options.transaction ?? options.session ?? this.db;
  }

  #getTransaction(options) {
    const transaction = options.transaction ?? options.session;

    if (!transaction) {
      throw new Error("Transaction is required for row locking.");
    }

    return transaction;
  }

  #requireTenant(tenantId) {
    if (!tenantId) {
      throw new Error("tenantId is required.");
    }
  }
}
