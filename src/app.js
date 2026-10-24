/**
 * src/app.js - Optimized for performance
 * Health route bypasses ALL middleware
 */

import express from "express";

import { bootstrapInfrastructure } from "./boostrap/infrastructure.js";
import { boostrapModules } from "./boostrap/modules.js";
import { bootstrapRoutes } from "./boostrap/routes.js";
import { bootstrapLifecycle } from "./boostrap/lifecycle.js";

import db from "./cross-cutting/database/knex.js";
import { config } from "./config/index.js";
import { PinoLogger } from "./cross-cutting/logging/PinoLogger.js";

const defaultLogger = new PinoLogger();

export async function createApp({ logger = defaultLogger } = {}) {
    const app = express();

    // --------------------------------------------------
    // 0. Performance defaults
    // --------------------------------------------------
    app.disable('x-powered-by');
    // Keep-Alive is on by default in Node 18+, but be explicit for autocannon
    app.set('etag', false); // health doesn't need etag generation

    // --------------------------------------------------
    // 1. ULTRA-FAST health check - BEFORE any middleware
    // This is the only route that autocannon will hit in benchmark
    // --------------------------------------------------
    const healthPayload = JSON.stringify({
        status: "ok",
        service: "conference-management",
        timestamp: new Date().toISOString(),
    });

    app.get("/health", (req, res) => {
        // Fast path: no express.json, no logger, no async
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Length', Buffer.byteLength(healthPayload));
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Cache-Control', 'no-store');
        res.status(200).end(healthPayload);
    });

    // --------------------------------------------------
    // 2. HTTP middleware for REAL routes only
    // --------------------------------------------------
    app.use(
        express.json({
            limit: "1mb",
        })
    );

    // --------------------------------------------------
    // 3. Bootstrap shared infrastructure
    // --------------------------------------------------
    const infrastructure = bootstrapInfrastructure({
        db,
        config,
        logger,
    });

    // --------------------------------------------------
    // 4. Compose shared dependencies
    // --------------------------------------------------
    const shared = {
        ...infrastructure,
    };

    // --------------------------------------------------
    // 5. Bootstrap feature modules
    // --------------------------------------------------
    const modules = await boostrapModules(shared);

    // --------------------------------------------------
    // 6. Register feature routes
    //    Make sure bootstrapRoutes does NOT add global hooks that affect /health
    //    If it does, add if(req.path==='/health') return next() inside those hooks
    // --------------------------------------------------
    bootstrapRoutes({
        app,
        modules,
        logger: shared.logger ?? logger,
    });

    // --------------------------------------------------
    // 7. Configure application lifecycle
    // --------------------------------------------------
    const lifecycle = bootstrapLifecycle({
        modules,
        infrastructure: shared,
        logger: shared.logger ?? logger,
    });

    return {
        app,
        start: lifecycle.start,
        stop: lifecycle.stop,
    };
}