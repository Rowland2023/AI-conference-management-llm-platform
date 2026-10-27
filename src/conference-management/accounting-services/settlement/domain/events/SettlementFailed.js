// settlement/domain/events/SettlementFailed.js

import { DomainEvent }
    from "../../../../../Shared/domain/DomainEvent.js";

export class SettlementFailed extends DomainEvent {

    constructor({

        settlementId,
        reason,

    }) {

        super({

            aggregateId: settlementId,
            eventName: "settlement.failed",

        });

        this.payload = {

            reason,

        };

    }

}