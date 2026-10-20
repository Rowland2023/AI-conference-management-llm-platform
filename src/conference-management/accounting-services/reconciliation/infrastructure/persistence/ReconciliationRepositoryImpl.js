// reconciliation/infrastructure/persistence/ReconciliationRepositoryImpl.js

import { ReconciliationRepository } from "../../domain/repositories/reconciliation_repository.js";
import { ReconciliationMapper } from "./ReconciliationMapper.js";

export class ReconciliationRepositoryImpl
    extends ReconciliationRepository {

    constructor(knex) {

        super();

        this.knex = knex;

    }

    async save(entity, tx = this.knex) {

        const data =
            ReconciliationMapper.toPersistence(entity);

        await tx("reconciliations")

            .insert(data)

            .onConflict("id")

            .merge();

    }

    async findById(id, tx = this.knex) {

        const row = await tx("reconciliations")

            .where({ id })

            .first();

        if (!row) {

            return null;

        }

        return ReconciliationMapper.toDomain(row);

    }

    async findOpenDiscrepancies(tx = this.knex) {

        return tx("discrepancies")

            .where({

                status: "OPEN",

            });

    }

    async listRuns(tx = this.knex) {

        return tx("reconciliations")

            .orderBy(

                "started_at",

                "desc",

            );

    }

}