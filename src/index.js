
/**
 * @file src/index.js
 *
 * Application Process Bootstrap
 *
 * Responsibilities:
 * - Create and start the application
 * - Start the HTTP server
 * - Handle process signals and fatal errors
 * - Gracefully shut down HTTP connections and application resources
 *
 * Does NOT know:
 * - Database implementation details
 * - Kafka implementation details
 * - Repository implementations
 * - Feature-module wiring
 */

import "dotenv/config";

import { createApp } from "./app.js";
import { PinoLogger } from "./cross-cutting/logging/PinoLogger.js";

const PORT = Number.parseInt(process.env.PORT ?? "3000", 10);
const SHUTDOWN_TIMEOUT_MS = 15_000;

const logger = new PinoLogger();

let application = null;
let server = null;
let shuttingDown = false;
let shutdownPromise = null;

/**
 * Normalize non-Error rejection reasons.
 *
 * @param {unknown} reason
 * @returns {Error}
 */
function toError(reason) {
    if (reason instanceof Error) {
        return reason;
    }

    return new Error(String(reason));
}

/**
 * Close the HTTP server and stop accepting new connections.
 *
 * @returns {Promise<void>}
 */
async function closeHttpServer() {
    if (!server?.listening) {
        return;
    }

    await new Promise((resolve, reject) => {
        server.close((error) => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });

        // Close idle keep-alive connections where supported.
        server.closeIdleConnections?.();
    });
}

/**
 * Stop application resources after HTTP traffic has drained.
 *
 * @returns {Promise<void>}
 */
async function stopApplication() {
    if (typeof application?.stop === "function") {
        await application.stop();
    }
}

/**
 * Gracefully shut down the application.
 *
 * Concurrent shutdown requests share the same promise.
 *
 * @param {string} signal
 * @param {Error|null} [fatalError=null]
 * @returns {Promise<void>}
 */
function shutdown(signal, fatalError = null) {
    if (shutdownPromise) {
        return shutdownPromise;
    }

    shuttingDown = true;

    shutdownPromise = (async () => {
        let shutdownFailed = false;

        logger.warn(
            {
                signal,
                error: fatalError,
            },
            "Graceful shutdown initiated"
        );

        const timeout = setTimeout(() => {
            logger.error(
                { signal, timeoutMs: SHUTDOWN_TIMEOUT_MS },
                "Shutdown timeout exceeded"
            );

            process.exit(1);
        }, SHUTDOWN_TIMEOUT_MS);

        try {
            // Stop accepting requests before stopping dependencies.
            await closeHttpServer();
        } catch (error) {
            shutdownFailed = true;

            logger.error(
                { error },
                "HTTP server shutdown failed"
            );
        }

        try {
            await stopApplication();
        } catch (error) {
            shutdownFailed = true;

            logger.error(
                { error },
                "Application resource shutdown failed"
            );
        } finally {
            clearTimeout(timeout);
        }

        const exitCode =
            fatalError || shutdownFailed ? 1 : 0;

        logger.info(
            { signal, exitCode },
            "Application shutdown completed"
        );

        process.exitCode = exitCode;
    })();

    return shutdownPromise;
}

/**
 * Install process-level handlers before startup.
 */
function installProcessHandlers() {
    process.once("SIGTERM", () => {
        void shutdown("SIGTERM");
    });

    process.once("SIGINT", () => {
        void shutdown("SIGINT");
    });

    process.once("uncaughtException", (error) => {
        logger.error(
            { error },
            "Uncaught exception"
        );

        void shutdown("uncaughtException", error);
    });

    process.once("unhandledRejection", (reason) => {
        const error = toError(reason);

        logger.error(
            { error },
            "Unhandled promise rejection"
        );

        void shutdown("unhandledRejection", error);
    });
}

/**
 * Start the application process.
 */
async function bootstrap() {
    installProcessHandlers();

    if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
        logger.error(
            { configuredPort: process.env.PORT },
            "Invalid HTTP port configuration"
        );

        process.exitCode = 1;
        return;
    }

    try {
        application = await createApp({ logger });

        if (shuttingDown) {
            await stopApplication();
            return;
        }

        const { app, start } = application ?? {};

        if (typeof app?.listen !== "function") {
            throw new TypeError(
                "createApp() must return an object containing an Express app"
            );
        }

        // Initialize infrastructure and background workers first.
        if (typeof start === "function") {
            await start();
        }

        if (shuttingDown) {
            await stopApplication();
            return;
        }

        server = app.listen(PORT);

        server.once("listening", () => {
            logger.info(
                {
                    port: server.address()?.port ?? PORT,
                    environment: process.env.NODE_ENV ?? "development",
                },
                "Conference Management API started"
            );
        });

        server.on("error", (error) => {
            logger.error(
                { error, port: PORT },
                "HTTP server failure"
            );

            void shutdown("server_error", error);
        });
    
} catch (error) {
    logger.error("Fatal bootstrap failure", {
        error: error.message,
        stack: error.stack,
        name: error.name,
        cause: error.cause?.message,
    });


        try {
            await stopApplication();
        } catch (cleanupError) {
            logger.error(
                { error: cleanupError },
                "Cleanup after bootstrap failure failed"
            );
        }

        process.exitCode = 1;
    }
}

void bootstrap();
