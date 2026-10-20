
import request from "supertest";
import { createApp } from "../../src/app.js";
import { createTestAuthHeaders } from "../helpers/auth.js";

describe("Event Schedule API Integration Tests", () => {
    let application;
    let app;

    beforeAll(async () => {
        application = await createApp();
        app = application.app;

        if (!app) {
            throw new Error("createApp() did not return an Express app.");
        }
    });

    afterAll(async () => {
        await application?.stop?.();
    });

    test("GET /api/v1/events returns the event list response", async () => {
        const response = await request(app)
            .get("/api/v1/events")
            .set(createTestAuthHeaders());

        console.log("Event list status:", response.status);
        console.log("Event list response:", response.body);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("success", true);
        expect(response.body).toHaveProperty("data");
    });
});
