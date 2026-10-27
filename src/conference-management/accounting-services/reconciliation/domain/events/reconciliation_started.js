// reconciliation/domain/events/ReconciliationStarted.js

import { DomainEvent } from "../../../../../Shared/domain/DomainEvent.js";

export class ReconciliationStarted extends DomainEvent {

    constructor({

        reconciliationId,

        type,

    }) {

        super({

            aggregateId: reconciliationId,

            eventName: "reconciliation.started",

            payload: {

                type,

            },

        });

    }

}