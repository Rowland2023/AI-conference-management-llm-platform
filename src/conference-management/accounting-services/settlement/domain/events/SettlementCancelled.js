// settlement/domain/events/SettlementCancelled.js

import { DomainEvent }
    from "../../../../../Shared/domain/DomainEvent.js";

export class SettlementCancelled extends DomainEvent {

    constructor({

        settlementId,
        reason,

    }) {

        super({

            aggregateId: settlementId,
            eventName: "settlement.cancelled",

        });

        this.payload = {

            reason,

        };

    }

}