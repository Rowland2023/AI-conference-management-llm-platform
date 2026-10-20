// tax/container.js

import { TaxPolicy }
    from "./domain/policies/TaxPolicy.js";

import { TaxRepository }
    from "./presentation/persistence/TaxRepository.js";

import { CalculateTaxUseCase }
    from "./use-case/CalculateTaxUseCase.js";

import { RecordTaxUseCase }
    from "./use-case/RecordTaxUseCase.js";

import { PayTaxUseCase }
    from "./use-case/PayTaxUseCase.js";

import { GetTaxUseCase }
    from "./use-case/GetTaxUseCase.js";

import { ListTaxesUseCase }
    from "./use-case/ListTaxesUseCase.js";

import { TaxService }
    from "./application/services/TaxService.js";

import { TaxController }
    from "./presentation/controllers/TaxController.js";

import { createTaxRouter }
    from "./presentation/routes/tax.routes.js";


export function createTaxContainer(shared) {

    const {

        knex,

        eventBus,

        transactionManager,

        logger,

    } = shared;


    //--------------------------------------------------
    // Domain
    //--------------------------------------------------

    const taxPolicy =
        new TaxPolicy();


    //--------------------------------------------------
    // Infrastructure
    //--------------------------------------------------

    const taxRepository =
        new TaxRepository({

            knex,

        });


    //--------------------------------------------------
    // Application
    //--------------------------------------------------

    const calculateTaxUseCase =
        new CalculateTaxUseCase({

            taxRepository,

            taxPolicy,

            transactionManager,

            eventBus,

            logger,

        });


    const recordTaxUseCase =
        new RecordTaxUseCase({

            taxRepository,

            transactionManager,

            eventBus,

            logger,

        });


    const payTaxUseCase =
        new PayTaxUseCase({

            taxRepository,

            transactionManager,

            eventBus,

            logger,

        });


    const getTaxUseCase =
        new GetTaxUseCase({

            taxRepository,

            logger,

        });


    const listTaxesUseCase =
        new ListTaxesUseCase({

            taxRepository,

            logger,

        });


    //--------------------------------------------------
    // Application Service
    //--------------------------------------------------

    const taxService =
        new TaxService({

            calculateTaxUseCase,

            recordTaxUseCase,

            payTaxUseCase,

            getTaxUseCase,

            listTaxesUseCase,

        });


    //--------------------------------------------------
    // Presentation
    //--------------------------------------------------

    const taxController =
        new TaxController({

            taxService,

        });


    const router =
        createTaxRouter({

            taxController,

        });


    //--------------------------------------------------
    // Composition Root
    //--------------------------------------------------

    return {

        router,

        controller:
            taxController,

        service:
            taxService,

        repository:
            taxRepository,

        useCases: {

            calculateTaxUseCase,

            recordTaxUseCase,

            payTaxUseCase,

            getTaxUseCase,

            listTaxesUseCase,

        },

    };

}