
// src/boostrap/lifecycle.js

export function bootstrapLifecycle({
    infrastructure,
    modules = [],
    logger,
}) {
    if (!infrastructure || typeof infrastructure !== "object") {
        throw new TypeError(
            "bootstrapLifecycle: infrastructure is required.",
        );
    }

    if (!Array.isArray(modules)) {
        throw new TypeError(
            "bootstrapLifecycle: modules must be an array.",
        );
    }

    if (!logger || typeof logger.info !== "function") {
        throw new TypeError(
            "bootstrapLifecycle: a valid logger is required.",
        );
    }

    const {
        kafkaConnection,
        eventBus,
        outboxWorker,
        redis,
    } = infrastructure;

    let startPromise = null;
    let stopPromise = null;
    let started = false;
    let stopped = false;

    async function invoke(target, method, message, ...args) {
        if (typeof target?.[method] !== "function") {
            return;
        }

        await target[method](...args);

        if (message) {
            logger.info(message);
        }
    }

    async function closeRedis() {
        if (!redis || redis.status === "end") {
            return;
        }

        // Graceful shutdown when the client is ready.
        if (
            redis.status === "ready" &&
            typeof redis.quit === "function"
        ) {
            await redis.quit();
            logger.info("Redis connection closed.");
            return;
        }

        // A client that is connecting or reconnecting cannot
        // reliably complete a graceful QUIT command.
        if (typeof redis.disconnect === "function") {
            redis.disconnect();
            logger.info("Redis client disconnected.");
        }
    }

    async function startInternal() {
        logger.info("Starting application lifecycle...");

        await invoke(
            kafkaConnection,
            "initialize",
            "Kafka connection initialized.",
        );

        await invoke(
            eventBus,
            "initialize",
            "Event bus initialized.",
        );

        await invoke(
            eventBus,
            "startConsuming",
            "Event consumers started.",
        );

        await invoke(
            outboxWorker,
            "start",
            "Outbox worker started.",
        );

        for (const module of modules) {
            await invoke(module, "start");
        }

        started = true;
        logger.info("Application started successfully.");
    }

    async function stopInternal() {
        logger.info("Stopping application lifecycle...");

        const errors = [];

        async function attempt(operation) {
            try {
                await operation();
            } catch (error) {
                errors.push(error);
                logger.error(
                    { error },
                    "Application shutdown operation failed.",
                );
            }
        }

        // Stop modules in reverse initialization order.
        for (const module of [...modules].reverse()) {
            await attempt(() =>
                invoke(module, "stop", null, eventBus),
            );
        }

        // Stop infrastructure in dependency order.
        await attempt(() =>
            invoke(
                outboxWorker,
                "stop",
                "Outbox worker stopped.",
            ),
        );

        await attempt(() =>
            invoke(
                eventBus,
                "shutdown",
                "Event bus stopped.",
            ),
        );

        await attempt(() =>
            invoke(
                kafkaConnection,
                "shutdown",
                "Kafka connection closed.",
            ),
        );

        await attempt(closeRedis);

        stopped = true;

        if (errors.length > 0) {
            throw new AggregateError(
                errors,
                "Application shutdown completed with errors.",
            );
        }

        logger.info("Application stopped successfully.");
    }

    function start() {
        if (stopPromise || stopped) {
            return Promise.reject(
                new Error(
                    "Cannot start the application after shutdown has begun.",
                ),
            );
        }

        if (startPromise) {
            return startPromise;
        }

        startPromise = startInternal().catch((error) => {
            // Permit a retry after a failed startup.
            startPromise = null;
            throw error;
        });

        return startPromise;
    }

    function stop() {
        if (stopPromise) {
            return stopPromise;
        }

        stopPromise = (async () => {
            // If startup is in progress, wait for it to settle
            // before releasing the resources it may have opened.
            if (startPromise) {
                try {
                    await startPromise;
                } catch {
                    // Continue cleanup after startup failure.
                }
            }

            await stopInternal();
        })();

        return stopPromise;
    }

    return {
        start,
        stop,
    };
}
