
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


import express from "express";
import db  from "./cross-cutting/database/knex.js";
import KnexUnitOfWork from "./cross-cutting/database/KnexUnitOfWork.js";

import { KafkaEventBus } from "./shared/infrastructure/messaging/kafka/KafkaEventBus.js";
import { OutboxWorker } from "./shared/infrastructure/messaging/outbox/OutboxWorker.js";

import { initLLM } from "./shared/infrastructure/ai/index.js";
import { LLMController } from "./shared/infrastructure/ai/api/llm.controller.js";
import { createLLMRouter } from "./shared/infrastructure/ai/api/llm.route.js";

import { AuthService } from "./shared-security-starter/application/AuthService.js";
import { authenticate } from "./shared-security-starter/presentation/authenticate.js";

import { createConferenceEventScheduleSubModule } from "./conference-management/event-schedule/index.js";
import { createAccountingServicesModule } from "./conference-management/accounting-services/index.js";
import { createConferenceRegistrationSubModule } from "./conference-management/registration/index.js";
import { createTicketModule } from "./conference-management/ticket/index.js";

export async function createApp({ logger = console } = {}) {

    const app = express();
    app.use(express.json({ limit: "1mb" }));

    //------------------------------------------------------------
    // Shared Infrastructure
    //------------------------------------------------------------

    const eventBus = new KafkaEventBus();

    const unitOfWorkFactory = () =>
        new KnexUnitOfWork({
            knex: db,
        });

    const outboxWorker = new OutboxWorker({
        db,
        messageClient: eventBus,
    });

    const authService = new AuthService();

    //------------------------------------------------------------
    // Feature Modules
    //------------------------------------------------------------

    const sharedDependencies = {
        db,
        eventBus,
        logger,
        unitOfWorkFactory,
    };

    const eventModule =
        createConferenceEventScheduleSubModule(sharedDependencies);

    const accountingModule =
        createAccountingServicesModule(sharedDependencies);

    const registrationModule =
        createConferenceRegistrationSubModule(sharedDependencies);

    const ticketModule =
        createTicketModule(sharedDependencies);

    const modules = [
        eventModule,
        accountingModule,
        registrationModule,
        ticketModule,
    ];

    //------------------------------------------------------------
    // Event subscriptions
    //------------------------------------------------------------

    for (const module of modules) {
        module.subscribe?.(eventBus);
    }

    //------------------------------------------------------------
    // AI
    //------------------------------------------------------------

    const llm = initLLM({
        openAIConfig: {
            apiKey: process.env.OPENAI_API_KEY,
        },
        unitOfWorkFactory,
        useCases: {
            ...eventModule.useCases,
            ...accountingModule.useCases,
            ...registrationModule.useCases,
            ...ticketModule.useCases,
        },
    });

    const llmRouter = createLLMRouter({
        llmController: new LLMController({
            commandInterceptor: llm.commandInterceptor,
            authService,
        }),
        authenticate,
    });

    //------------------------------------------------------------
    // HTTP Routes
    //------------------------------------------------------------

    eventModule.router &&
        app.use("/api/events", eventModule.router);

    registrationModule.router &&
        app.use("/api/registrations", registrationModule.router);

    ticketModule.router &&
        app.use("/api/tickets", ticketModule.router);

    accountingModule.router &&
        app.use("/api/accounting", accountingModule.router);

    app.use("/api/ai", llmRouter);

    app.get("/health", (req, res) =>
        res.json({
            status: "UP",
            timestamp: new Date().toISOString(),
        })
    );

    //------------------------------------------------------------
    // Errors
    //------------------------------------------------------------

    app.use((req, res) => {
        res.status(404).json({
            success: false,
            error: {
                code: "NOT_FOUND",
                message: "Route not found",
            },
        });
    });

    app.use((err, req, res, next) => {
        logger.error(err);

        res.status(err.statusCode || 500).json({
            success: false,
            error: {
                code: err.code || "INTERNAL_SERVER_ERROR",
                message: err.message,
            },
        });
    });

    //------------------------------------------------------------
    // Lifecycle
    //------------------------------------------------------------

    async function start() {

        await eventBus.connect();

        await outboxWorker.start();

        for (const module of modules) {
            await module.start?.();
        }

        logger.info("Application started.");
    }

    async function stop() {

        for (const module of modules) {
            await module.stop?.();
        }

        await outboxWorker.stop();

        await eventBus.disconnect();

        logger.info("Application stopped.");
    }

    return {
        app,
        start,
        stop,
    };
}