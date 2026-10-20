// reconciliation/application/use_cases/StartReconciliationUseCase.js

import { Reconciliation } from "../../domain/entities/Reconciliation.js";
import { ReconciliationStarted } from "../../domain/events/reconciliation_started.js";
import { ReconciliationResponse } from "../dto/ReconciliationResponse.js";

export class StartReconciliationUseCase {

    constructor({

        reconciliationRepository,

        transactionManager,

        eventBus,

    }) {

        this.reconciliationRepository = reconciliationRepository;
        this.transactionManager = transactionManager;
        this.eventBus = eventBus;

    }

    async execute(command) {

        return this.transactionManager.runInTransaction(async (tx) => {

            const reconciliation = new Reconciliation({

                type: command.type,

                createdBy: command.createdBy,

            });

            reconciliation.start();

            await this.reconciliationRepository.save(
                reconciliation,
                tx,
            );

            await this.eventBus.publish(

                new ReconciliationStarted({

                    reconciliationId: reconciliation.id,

                    type: reconciliation.type,

                }),

                tx,

            );

            return new ReconciliationResponse({

                id: reconciliation.id,

                type: reconciliation.type,

                status: reconciliation.status,

                startedAt: reconciliation.startedAt,

                completedAt: reconciliation.completedAt,

                discrepancies: [],

            });

        });

    }

}