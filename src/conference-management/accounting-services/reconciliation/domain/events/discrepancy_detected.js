// reconciliation/domain/events/DiscrepancyDetected.js

import { DomainEvent } from "../../../../../Shared/domain/DomainEvent.js";

export class DiscrepancyDetected extends DomainEvent {

    constructor({

        reconciliationId,

        discrepancyId,

        transactionId,

        expectedAmount,

        actualAmount,

        reason,

    }) {

        super({

            aggregateId: reconciliationId,

            eventName: "reconciliation.discrepancy_detected",

            payload: {

                discrepancyId,

                transactionId,

                expectedAmount,

                actualAmount,

                reason,

            },

        });

    }

}