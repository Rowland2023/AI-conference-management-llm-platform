// src/app.js

import express from "express";

import { bootstrapInfrastructure } from "./boostrap/infrastructure.js";
import { boostrapModules } from "./boostrap/modules.js";
import { bootstrapRoutes } from "./boostrap/routes.js";
import { bootstrapLifecycle } from "./boostrap/lifecycle.js";

import db from "./cross-cutting/database/knex.js";
import { config } from "./config/index.js";

import { PinoLogger } from "./cross-cutting/logging/PinoLogger.js";

const defaultLogger = new PinoLogger();

export async function createApp({
    logger = defaultLogger,
} = {}) {

    const app = express();

    app.use(
        express.json({
            limit: "1mb",
        })
    );
    
    //
// Health Check
//
app.get(
    "/health",
    (req, res) => {

        res.status(200).json({

            status: "ok",

            service:
                "conference-management",

            timestamp:
                new Date().toISOString(),

        });

    }
);
    //
    // 1. Boostrap Infrastructure
    //
    const infrastructure =
        bootstrapInfrastructure({
            db,
            config,
            logger,
        });

    //
    
    // 3. Compose Shared Dependency Container
    //
    const shared = {
        ...infrastructure,

    };

    //
    // 4. Boostrap Feature Modules
    //
    const modules =
        await boostrapModules(shared);

    //
    // 5. Register Routes
    //
    bootstrapRoutes({
        app,
        modules,
        logger: shared.logger,
    });

    //
    // 6. Boostrap Lifecycle
    //
    const lifecycle =
        bootstrapLifecycle({
            modules,
            infrastructure: shared,
            logger: shared.logger,
        });

    return {
        app,
        start: lifecycle.start,
        stop: lifecycle.stop,
    };

}