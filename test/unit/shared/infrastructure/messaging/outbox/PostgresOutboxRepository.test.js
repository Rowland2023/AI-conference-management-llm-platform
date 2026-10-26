import { PostgresOutboxRepository }
    from "../../../../../../src/Shared/Infrastructure/messaging/outbox/PostgresOutboxRepository.js";

import { BaseDomainEvent }
    from "../../../../../../src/conference-management/accounting-services/ledger/domain/events/base-domain.event.js";


describe("PostgresOutboxRepository", () => {
    let db;
    let trx;
    let insert;
    let repository;

    beforeEach(() => {
        insert = jest.fn().mockResolvedValue(undefined);

        const queryBuilder = { insert };

        trx = jest.fn().mockReturnValue(queryBuilder);
        trx.fn = {
            now: jest.fn().mockReturnValue("DB_NOW"),
        };

        db = jest.fn();
        repository = new PostgresOutboxRepository({ db });
    });

    test("persists event fields from BaseDomainEvent getters", async () => {
        const occurredAt = new Date("2026-10-25T10:30:00.000Z");

        const event = new BaseDomainEvent({
            eventId: "11111111-1111-4111-8111-111111111111",
            eventName: "account.held",
            aggregateId: "account-123",
            occurredAt,
            payload: {
                accountId: "account-123",
                amount: "250.00",
            },
            metadata: {
                aggregateType: "Account",
                correlationId: "22222222-2222-4222-8222-222222222222",
            },
        });

        await repository.save(event, trx);

        expect(trx).toHaveBeenCalledWith("outbox_events");
        expect(insert).toHaveBeenCalledTimes(1);

        expect(insert).toHaveBeenCalledWith([
            {
                id: event.eventId,
                aggregate_type: "Account",
                aggregate_id: "account-123",
                event_type: "account.held",
                payload: JSON.stringify({
                    accountId: "account-123",
                    amount: "250.00",
                }),
                status: "PENDING",
                retry_count: 0,
                max_retries: 5,
                next_retry_at: "DB_NOW",
                correlation_id: "22222222-2222-4222-8222-222222222222",
                created_at: occurredAt,
            },
        ]);
    });

    test("persists multiple events in one insert using the supplied transaction", async () => {
        const firstEvent = new BaseDomainEvent({
            eventId: "11111111-1111-4111-8111-111111111111",
            eventName: "account.held",
            aggregateId: "account-123",
            payload: { holdId: "hold-1" },
        });

        const secondEvent = new BaseDomainEvent({
            eventId: "33333333-3333-4333-8333-333333333333",
            eventName: "account.released",
            aggregateId: "account-456",
            payload: { holdId: "hold-2" },
        });

        await repository.save([firstEvent, secondEvent], trx);

        expect(trx).toHaveBeenCalledTimes(1);
        expect(trx).toHaveBeenCalledWith("outbox_events");
        expect(insert).toHaveBeenCalledTimes(1);

        const rows = insert.mock.calls[0][0];

        expect(rows).toHaveLength(2);
        expect(rows[0]).toMatchObject({
            id: firstEvent.eventId,
            aggregate_id: firstEvent.aggregateId,
            event_type: firstEvent.eventName,
            payload: JSON.stringify(firstEvent.payload),
        });
        expect(rows[1]).toMatchObject({
            id: secondEvent.eventId,
            aggregate_id: secondEvent.aggregateId,
            event_type: secondEvent.eventName,
            payload: JSON.stringify(secondEvent.payload),
        });
    });

    test("rejects construction without a database instance", () => {
        expect(
            () => new PostgresOutboxRepository({})
        ).toThrow("PostgresOutboxRepository requires a Knex instance.");
    });
});
