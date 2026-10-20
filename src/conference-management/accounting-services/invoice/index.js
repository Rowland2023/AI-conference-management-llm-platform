
/**
 * src/conference-management/accounting-services/invoice/index.js
 */

import createInvoiceRoutes
    from "./presentation/routes/invoice.routes.js";

import { InvoiceController }
    from "./presentation/controller/InvoiceController.js";

import { PostgresInvoiceRepository }
    from "./infrastructure/repositories/PostgresInvoiceRepository.js";

import { InvoiceService }
    from "./application/services/InvoiceService.js";

import { CreateInvoiceUseCase }
    from "./application/use_case/CreateInvoiceUseCase.js";

import { CancelInvoiceUseCase }
    from "./application/use_case/CancelInvoiceUseCase.js";

import { IssueInvoiceUseCase }
    from "./application/use_case/IssueInvoiceUseCase.js";

import { RecordPaymentUseCase }
    from "./application/use_case/RecordPaymentUseCase.js";

import { SequentialInvoiceNumberGenerator }
    from "./infrastructure/services/SequentialInvoiceNumberGenerator.js";


/**
 * Initialize the Invoice bounded context.
 */
export function createInvoiceModule({
    knex,
    transactionManager,
    invoiceNumberGenerator: suppliedInvoiceNumberGenerator,
    logger = console,
} = {}) {

    // --------------------------------------------------
    // 1. Validate infrastructure
    // --------------------------------------------------

    if (!knex || typeof knex.transaction !== "function") {
        throw new TypeError(
            "InvoiceModule: a valid Knex instance is required.",
        );
    }

    if (
        !transactionManager ||
        typeof transactionManager.run !== "function"
    ) {
        throw new TypeError(
            "InvoiceModule: transactionManager must implement run().",
        );
    }

    // --------------------------------------------------
    // 2. Infrastructure
    // --------------------------------------------------

    const invoiceRepository = new PostgresInvoiceRepository({
        knex,
    });

    // Use an injected generator when provided; otherwise
    // instantiate the existing sequential implementation.
    const invoiceNumberGenerator =
        suppliedInvoiceNumberGenerator ??
        new SequentialInvoiceNumberGenerator(
            knex
        );

    if (
        !invoiceNumberGenerator ||
        typeof invoiceNumberGenerator.generate !== "function"
    ) {
        throw new TypeError(
            "InvoiceModule: invoiceNumberGenerator must implement generate({ trx }).",
        );
    }

    // --------------------------------------------------
    // 3. Application use cases
    // --------------------------------------------------

    const createInvoiceUseCase = new CreateInvoiceUseCase({
        invoiceRepository,
        invoiceNumberGenerator,
        transactionManager,
    });

    const cancelInvoiceUseCase = new CancelInvoiceUseCase({
        invoiceRepository,
        transactionManager,
    });

    const issueInvoiceUseCase = new IssueInvoiceUseCase({
        invoiceRepository,
        transactionManager,
    });

    const recordPaymentUseCase = new RecordPaymentUseCase({
        invoiceRepository,
        transactionManager,
    });

    // --------------------------------------------------
    // 4. Application service
    // --------------------------------------------------

    const invoiceService = new InvoiceService({
        createInvoiceUseCase,
        cancelInvoiceUseCase,
        issueInvoiceUseCase,
        recordPaymentUseCase,
    });

    // --------------------------------------------------
    // 5. Presentation
    // --------------------------------------------------

    const invoiceController = new InvoiceController({
        invoiceService,
    });

    const router = createInvoiceRoutes({
        invoiceController,
    });

    // --------------------------------------------------
    // 6. Public module API
    // --------------------------------------------------

    return {
        name: "invoice",
        router,
        controller: invoiceController,
        service: invoiceService,
        repository: invoiceRepository,

        invoiceNumberGenerator,

        useCases: {
            createInvoiceUseCase,
            cancelInvoiceUseCase,
            issueInvoiceUseCase,
            recordPaymentUseCase,
        },
    };
}
