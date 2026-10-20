// settlement/index.js

import { Router } from "express";

//=====================================================
// Domain
//=====================================================

import { SettlementPolicy }
    from "./domain/services/SettlementPolicy.js";


//=====================================================
// Infrastructure
//=====================================================

import { SettlementRepository }
    from "./infrastructure/persistence/SettlementRepository.js";


//=====================================================
// Application
//=====================================================

import { CreateSettlementUseCase }
    from "./application/use-cases/CreateSettlementUseCase.js";

import { ScheduleSettlementUseCase }
    from "./application/use-cases/ScheduleSettlementUseCase.js";

import { CompleteSettlementUseCase }
    from "./application/use-cases/CompleteSettlementUseCase.js";

import { CancelSettlementUseCase }
    from "./application/use-cases/CancelSettlementUseCase.js";

import { GetSettlementUseCase }
    from "./application/use-cases/GetSettlementUseCase.js";

import { ListSettlementsUseCase }
    from "./application/use-cases/ListSettlementsUseCase.js";


//=====================================================
// Presentation
//=====================================================

import { SettlementController }
    from "./presentation/controllers/SettlementController.js";

import { createSettlementRoutes }
    from "./presentation/routes/settlement.routes.js";


export function createSettlementModule(shared) {

    //--------------------------------------------------
    // Shared Dependencies
    //--------------------------------------------------

    const {

        knex,

        logger,

        eventBus,

        transactionManager,

    } = shared;


    //--------------------------------------------------
    // Infrastructure
    //--------------------------------------------------

    const settlementRepository =
        new SettlementRepository({

            knex,

        });


    //--------------------------------------------------
    // Domain Services / Policies
    //--------------------------------------------------

    const settlementPolicy =
        new SettlementPolicy();


    //--------------------------------------------------
    // Use Cases
    //--------------------------------------------------

    const createSettlementUseCase =
        new CreateSettlementUseCase({

            settlementRepository,

            settlementPolicy,

            transactionManager,

            eventBus,

            logger,

        });


    const scheduleSettlementUseCase =
        new ScheduleSettlementUseCase({

            settlementRepository,

            transactionManager,

            eventBus,

            logger,

        });


    const completeSettlementUseCase =
        new CompleteSettlementUseCase({

            settlementRepository,

            transactionManager,

            eventBus,

            logger,

        });


    const cancelSettlementUseCase =
        new CancelSettlementUseCase({

            settlementRepository,

            transactionManager,

            eventBus,

            logger,

        });


    const getSettlementUseCase =
        new GetSettlementUseCase({

            settlementRepository,

            logger,

        });


    const listSettlementsUseCase =
        new ListSettlementsUseCase({

            settlementRepository,

            logger,

        });


    //--------------------------------------------------
    // Controller
    //--------------------------------------------------

    const controller =
        new SettlementController({

            createSettlementUseCase,

            scheduleSettlementUseCase,

            completeSettlementUseCase,

            cancelSettlementUseCase,

            getSettlementUseCase,

            listSettlementsUseCase,

        });


    //--------------------------------------------------
    // Routes
    //--------------------------------------------------

    const router =
        createSettlementRoutes({

            controller,

        });


    //--------------------------------------------------
    // Module API
    //--------------------------------------------------

    return {

        name:
            "settlement",

        basePath:
            "/settlements",

        router,

        useCases: {

            createSettlementUseCase,

            scheduleSettlementUseCase,

            completeSettlementUseCase,

            cancelSettlementUseCase,

            getSettlementUseCase,

            listSettlementsUseCase,

        },

        async start() {

            logger.info(
                "Settlement module started."
            );

        },

        async stop() {

            logger.info(
                "Settlement module stopped."
            );

        },

    };

}