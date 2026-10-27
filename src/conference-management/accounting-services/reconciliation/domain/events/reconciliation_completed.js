// reconciliation/domain/events/ReconciliationCompleted.js

import { DomainEvent } from "../../../../../Shared/domain/DomainEvent.js";

export class ReconciliationCompleted extends DomainEvent {

    constructor({

        reconciliationId,

        totalTransactions,

        matchedTransactions,

        unmatchedTransactions,

    }) {

        super({

            aggregateId: reconciliationId,

            eventName: "reconciliation.completed",

            payload: {

                totalTransactions,

                matchedTransactions,

                unmatchedTransactions,

            },

        });

    }

}