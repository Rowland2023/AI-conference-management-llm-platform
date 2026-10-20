/**
 * @file src/conference-management/accounting-services/ledger/presentation/controller/journal.controller.js
 *
 * Journal Entry HTTP Controller.
 *
 * Thin HTTP adapter that delegates journal operations to LedgerService.
 * Enforces tenant context at the HTTP boundary.
 */

export default class JournalController {
    constructor({ ledgerService }) {
        if (!ledgerService) {
            throw new TypeError("ledgerService is required.");
        }

        this.ledgerService = ledgerService;
    }

    /**
     * POST /journals
     * Creates a journal entry.
     */
    postEntry = async (req, res, next) => {
        try {
            const tenantId = this.#getTenantId(req);

            if (!tenantId) {
                return res.status(401).json({
                    message: "Authenticated tenant context is required.",
                });
            }

            const body = req.body ?? {};

            const entry = await this.ledgerService.postJournalEntry({
                ...body,
                tenantId,
                actor: req.actor,
                idempotencyKey: this.#getIdempotencyKey(req, body),
                correlationId: req.correlationId,
            });

            return res.status(201).json(entry);
        } catch (error) {
            return next(error);
        }
    };

    /**
     * POST /journals/:id/reverse
     * Reverses an existing journal entry.
     */
    reverseEntry = async (req, res, next) => {
        try {
            const tenantId = this.#getTenantId(req);

            if (!tenantId) {
                return res.status(401).json({
                    message: "Authenticated tenant context is required.",
                });
            }

            const body = req.body ?? {};

            const entry = await this.ledgerService.reverseJournalEntry({
                id: req.params.id,
                tenantId,
                actor: req.actor,
                reason: body.reason,
                idempotencyKey: this.#getIdempotencyKey(req, body),
                correlationId: req.correlationId,
            });

            return res.status(200).json(entry);
        } catch (error) {
            return next(error);
        }
    };

    /**
     * GET /journals/:id
     * Retrieves a journal entry within the authenticated tenant.
     */
    getEntry = async (req, res, next) => {
        try {
            const tenantId = this.#getTenantId(req);

            if (!tenantId) {
                return res.status(401).json({
                    message: "Authenticated tenant context is required.",
                });
            }

            const entry = await this.ledgerService.getJournalEntry({
                id: req.params.id,
                tenantId,
            });

            if (!entry) {
                return res.status(404).json({
                    message: "Journal entry not found.",
                });
            }

            return res.status(200).json(entry);
        } catch (error) {
            return next(error);
        }
    };

    /**
     * Reads the tenant ID established by authentication middleware.
     */
    #getTenantId(req) {
        const tenantId = req.actor?.tenantId;

        if (
            tenantId == null ||
            String(tenantId).trim() === ""
        ) {
            return null;
        }

        return tenantId;
    }

    /**
     * Supports the Idempotency-Key header, with a body fallback.
     */
    #getIdempotencyKey(req, body = {}) {
        const headerValue = req.get
            ? req.get("Idempotency-Key")
            : req.headers?.["idempotency-key"];

        return headerValue || body.idempotencyKey;
    }
}