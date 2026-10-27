// settlement/domain/events/SettlementCreated.js

import { DomainEvent }
    from "../../../../../Shared/domain/DomainEvent.js";

export class SettlementCreated extends DomainEvent {

    constructor({

        settlementId,
        merchantId,
        amount,
        currency,
        method,

    }) {

        super({

            aggregateId: settlementId,
            eventName: "settlement.created",

        });

        this.payload = {

            merchantId,
            amount,
            currency,
            method,

        };

    }

}