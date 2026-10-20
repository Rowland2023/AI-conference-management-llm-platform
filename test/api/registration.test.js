
import { randomUUID } from "node:crypto";
import request from "supertest";
import { createApp } from "../../src/app.js";
import db from "../../src/cross-cutting/database/knex.js";
import { createTestAuthHeaders } from "../helpers/auth.js";

describe("Registration API Integration Tests", () => {
    let application;
    let app;
    let conferenceId;

    beforeAll(async () => {
        application = await createApp();
        app = application.app;

        if (!app) {
            throw new Error("createApp() did not return an Express app.");
        }

        conferenceId = randomUUID();

        await db("conferences").insert({
            id: conferenceId,
            title: "Registration API integration test",
            registration_open: true,
            ticket_tier_capacities: {},
        });
    });

    afterAll(async () => {
        try {
            if (conferenceId) {
                // Find registrations created for this test conference.
                const registrations = await db("registrations")
                    .where({ conference_id: conferenceId })
                    .select("id");

                const registrationIds = registrations.map(row => row.id);

                // Remove outbox events belonging to these registrations.
                if (registrationIds.length > 0) {
                    await db("outbox_events")
                        .whereIn("aggregate_id", registrationIds)
                        .del();
                }

                // Remove only data associated with this test fixture.
                await db("registrations")
                    .where({ conference_id: conferenceId })
                    .del();

                await db("conferences")
                    .where({ id: conferenceId })
                    .del();
            }
        } finally {
            await application?.stop?.();
        }
    });

    test("POST /registrations creates a registration", async () => {
        const response = await request(app)
            .post("/api/v1/registrations")
            .set(createTestAuthHeaders())
            .send({
                eventId: conferenceId,
                ticketType: "standard",
            });

        console.log("Registration status:", response.status);
        console.log("Registration response body:", response.body);

        expect(response.status).toBe(201);
        expect(response.body).toBeDefined();
    });
});
