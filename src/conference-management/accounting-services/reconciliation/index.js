
// src/conference-management/accounting-services/reconciliation/index.js

import express from "express";

const MODULE_NAME = "reconciliation";

/**
 * Reconciliation is temporarily isolated because the implementation
 * is incomplete. This module exposes a stable bootstrap interface so
 * unrelated application modules can start normally.
 */
export function createReconciliationModule(shared) {
    if (!shared || typeof shared !== "object") {
        throw new TypeError(
            "ReconciliationModule: shared dependencies are required."
        );
    }

    const logger = shared.logger ?? console;
    const router = express.Router();

    let started = false;

    return {
        name: MODULE_NAME,
        enabled: false,
        router,

        useCases: {},
        services: {},
        repositories: {},

        // Preserve compatibility with optional module lifecycle hooks.
        subscribe() {
            logger.warn?.(
                "[reconciliation] Event subscriptions are disabled."
            );
        },

        async start() {
            if (started) return;

            started = true;
            logger.warn?.(
                "[reconciliation] Disabled: required use cases and " +
                "persistence are not yet implemented."
            );
        },

        async stop() {
            if (!started) return;

            started = false;
            logger.info?.("[reconciliation] Module stopped.");
        },
    };
}
