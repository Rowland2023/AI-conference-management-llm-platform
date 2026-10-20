// reconciliation/domain/entities/Reconciliation.js

import { randomUUID } from "crypto";

import { ReconciliationStatus } from "../value-objects/reconciliation_status.js";

export class Reconciliation {

    constructor({

        id = randomUUID(),

        type,

        createdBy,

        status = ReconciliationStatus.PENDING,

        discrepancies = [],

    }) {

        this.id = id;

        this.type = type;

        this.createdBy = createdBy;

        this.status = status;

        this.discrepancies = discrepancies;

        this.startedAt = null;

        this.completedAt = null;

    }

    start() {

        this.status = ReconciliationStatus.RUNNING;

        this.startedAt = new Date();

    }

    complete() {

        this.status = ReconciliationStatus.COMPLETED;

        this.completedAt = new Date();

    }

    fail() {

        this.status = ReconciliationStatus.FAILED;

    }

    addDiscrepancy(discrepancy) {

        this.discrepancies.push(discrepancy);

    }

}