// src/conference-management/accounting-services/index.js

import { Router } from "express";

import { createLedgerModule } from "./ledger/index.js";
import { createPaymentModule } from "./payment/index.js";
import { createInvoiceModule } from "./invoice/index.js";
import { createRefundModule } from "./refund/index.js";
import { createReconciliationModule } from "./reconciliation/index.js";
import { createSettlementModule } from "./settlement/index.js";
import { createTaxModule } from "./tax/index.js";

/**
 * Resolve the Knex instance from the shared infrastructure.
 *
 * Supports:
 *   shared.knex
 *   shared.db.knex
 *   shared.db (when it is itself a Knex instance)
 */
function resolveKnex(shared) {
    const knex =
        shared.knex ??
        shared.db?.knex ??
        shared.db;

    if (
        !knex ||
        typeof knex.transaction !== "function"
    ) {
        throw new TypeError(
            "AccountingServices: a valid Knex instance is required. " +
            "Provide shared.knex or shared.db.",
        );
    }

    return knex;
}

/**
 * Adapt an existing transaction manager or unit of work to
 * the interface expected by invoice use cases:
 *
 *     transactionManager.run(async (trx) => { ... })
 *
 * Supported source interfaces:
 *   - run(operation, options)
 *   - runInTransaction(operation, options)
 *   - execute(operation, options)
 */
function createInvoiceTransactionManager(shared) {
    const manager =
        shared.transactionManager ??
        (
            typeof shared.unitOfWorkFactory === "function"
                ? shared.unitOfWorkFactory()
                : null
        );

    if (!manager) {
        throw new Error(
            "AccountingServices: transaction manager is required. " +
            "Provide shared.transactionManager or shared.unitOfWorkFactory.",
        );
    }

    if (typeof manager.run === "function") {
        return manager;
    }

    if (typeof manager.runInTransaction === "function") {
        return {
            run(operation, options) {
                return manager.runInTransaction(
                    operation,
                    options,
                );
            },
        };
    }

    if (typeof manager.execute === "function") {
        return {
            run(operation, options) {
                return manager.execute(
                    operation,
                    options,
                );
            },
        };
    }

    throw new TypeError(
        "AccountingServices: unsupported transaction manager. " +
        "Expected run(), runInTransaction(), or execute().",
    );
}

/**
 * Validate the router returned by a bounded-context module.
 */
function mountModule(router, path, module, moduleName) {
    if (
        !module ||
        typeof module.router !== "function"
    ) {
        throw new TypeError(
            `AccountingServices: ${moduleName} must expose an Express router.`,
        );
    }

    router.use(path, module.router);
}

/**
 * Initialize all accounting bounded contexts and compose
 * their routers under a single accounting-services router.
 *
 * @param {object} shared
 * @returns {object}
 */
export function createAccountingServicesModule(shared = {}) {
    if (
        !shared ||
        typeof shared !== "object" ||
        Array.isArray(shared)
    ) {
        throw new TypeError(
            "AccountingServices: shared infrastructure must be an object.",
        );
    }

    // Keep all injected infrastructure and configuration intact.
    const sharedContext = {
        ...shared,
    };

    // Resolve shared infrastructure once.
    const knex = resolveKnex(sharedContext);

    sharedContext.knex = knex;

    // ---------------------------------------------------------
    // 1. Initialize bounded-context modules
    // ---------------------------------------------------------

    const ledgerModule = createLedgerModule(
        sharedContext,
    );

    const paymentModule = createPaymentModule(
        sharedContext,
    );

    // Invoice use cases expect transactionManager.run(...).
    // Adapt the existing unit-of-work/transaction API as needed.
    const transactionManager =
        createInvoiceTransactionManager(sharedContext);

    const invoiceModule = createInvoiceModule({
        ...sharedContext,
        knex,
        transactionManager,
    });

    const refundModule = createRefundModule(
        sharedContext,
    );

    const reconciliationModule = createReconciliationModule(
        sharedContext,
    );

    const settlementModule = createSettlementModule(
        sharedContext,
    );

    const taxModule = createTaxModule(
        sharedContext,
    );

    // ---------------------------------------------------------
    // 2. Compose bounded-context routers
    // ---------------------------------------------------------

    const router = Router();

    mountModule(
        router,
        "/ledger",
        ledgerModule,
        "LedgerModule",
    );

    mountModule(
        router,
        "/payments",
        paymentModule,
        "PaymentModule",
    );

    mountModule(
        router,
        "/invoices",
        invoiceModule,
        "InvoiceModule",
    );

    mountModule(
        router,
        "/refunds",
        refundModule,
        "RefundModule",
    );

    mountModule(
        router,
        "/reconciliation",
        reconciliationModule,
        "ReconciliationModule",
    );

    mountModule(
        router,
        "/settlements",
        settlementModule,
        "SettlementModule",
    );

    mountModule(
        router,
        "/tax",
        taxModule,
        "TaxModule",
    );

    // ---------------------------------------------------------
    // 3. Return the composed module and its bounded contexts
    // ---------------------------------------------------------

    return {
        router,

        // Shared dependencies used by accounting modules.
        knex,
        transactionManager,
        eventBus: sharedContext.eventBus,
        outboxWorker: sharedContext.outboxWorker,
        logger: sharedContext.logger,

        // Bounded-context module handles.
        ledgerModule,
        paymentModule,
        invoiceModule,
        refundModule,
        reconciliationModule,
        settlementModule,
        taxModule,
    };
}