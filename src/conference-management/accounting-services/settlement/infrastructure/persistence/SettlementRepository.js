// settlement/infrastructure/persistence/SettlementRepository.js

import { SettlementRepository as SettlementRepositoryPort }
    from "../../domain/repositories/settlement_repository.js";

import { SettlementMapper }
    from "./SettlementMapper.js";


export class SettlementRepository
    extends SettlementRepositoryPort {

    constructor({

        knex,

    }) {

        super();

        this.knex =
            knex;

    }


    client(tx) {

        return tx ?? this.knex;

    }


    async save(settlement, tx) {

        const db =
            this.client(tx);

        const data =
            SettlementMapper.toPersistence(

                settlement,

            );

        await db("settlements")

            .insert(data)

            .onConflict("id")

            .merge();

    }


    async findById(id, tx) {

        const db =
            this.client(tx);

        const record =
            await db("settlements")

                .where({

                    id,

                })

                .first();

        return SettlementMapper.toDomain(

            record,

        );

    }


    async findAll(filters = {}) {

        let query =
            this.knex("settlements");

        if (filters.merchantId) {

            query.where({

                merchant_id:
                    filters.merchantId,

            });

        }

        if (filters.status) {

            query.where({

                status:
                    filters.status,

            });

        }

        const rows =
            await query;

        return rows.map(

            SettlementMapper.toDomain,

        );

    }

}