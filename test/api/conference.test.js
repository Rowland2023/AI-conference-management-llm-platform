
import request from "supertest";
import { createApp } from "../../src/app.js";
import { createTestAuthHeaders } from "../helpers/auth.js";

describe("Conference Management API Integration Tests", () => {
    let application;
    let app;

    beforeAll(async () => {
        application = await createApp();
        app = application?.app;

        if (!app) {
            throw new Error(
                "createApp() did not return an Express app.",
            );
        }
    });

    afterAll(async () => {
        await application?.stop?.();
    });

    describe("Health endpoints", () => {
        test("GET /health returns the service health response", async () => {
            const response = await request(app).get("/health");

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                status: "ok",
                service: "conference-management",
            });
            expect(response.body.timestamp).toEqual(
                expect.any(String),
            );
            expect(Number.isNaN(Date.parse(response.body.timestamp)))
                .toBe(false);
        });

        test("GET / returns the API health response", async () => {
            const response = await request(app).get("/");

            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                service: "Conference Management API",
                status: "healthy",
            });
        });
    });

    describe("Route handling", () => {
        test("unknown routes return HTTP 404", async () => {
            const response = await request(app)
                .get("/api/v1/this-route-does-not-exist");

            expect(response.status).toBe(404);
            expect(response.body).toEqual({
                error: "Route not found",
            });
        });

        test("GET /api/v1/events returns the event-list response", async () => {
            const response = await request(app)
                .get("/api/v1/events")
                .set(createTestAuthHeaders());

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty("success", true);
            expect(response.body).toHaveProperty("data");
        });
    });
});
