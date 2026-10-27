import { z } from "zod";
import { AssistantService } from "../../../src/Shared/Infrastructure/ai/AssistantService.js";
import {
    LLMError,
    LLMUseCaseMappingError,
} from "../../../src/Shared/Infrastructure/ai/errors.js";
import { jest } from "@jest/globals";

describe("AssistantService", () => {
    let service;
    let openAIClient;
    let registry;
    let interceptor;
    let pendingStore;
    let audit;
    let telemetry;
    let onToken;
    let userContext;
    let tool;

    const makeProposal = (overrides = {}) => ({
        kind: "tool",
        name: "get_event",
        args: { event_id: "event-1" },
        usage: { prompt_tokens: 10, completion_tokens: 5 },
        promptHash: "hash-123",
        ...overrides,
    });

    beforeEach(() => {
        tool = {
            name: "get_event",
            zodSchema: z.object({
                event_id: z.string(),
            }),
            requiresConfirmation: false,
        };

        openAIClient = {
            propose: jest.fn().mockResolvedValue(makeProposal()),
        };

        registry = {
            toolsFor: jest.fn().mockResolvedValue({
                openAITools: [
                    {
                        type: "function",
                        function: {
                            name: "get_event",
                            description: "Get an event",
                            parameters: {},
                        },
                    },
                ],
                allowed: new Set(["get_event"]),
            }),
            get: jest.fn().mockReturnValue(tool),
        };

        interceptor = {
            authorize: jest.fn().mockResolvedValue(undefined),
            execute: jest.fn().mockResolvedValue({
                event_id: "event-1",
                title: "Test event",
            }),
        };

        pendingStore = {
            save: jest.fn().mockResolvedValue(undefined),
            take: jest.fn().mockResolvedValue(null),
        };

        audit = {
            record: jest.fn().mockResolvedValue(undefined),
        };

        telemetry = {
            counter: jest.fn(),
        };

        onToken = jest.fn();

        userContext = {
            id: "user-1",
            tenantId: "tenant-1",
            roles: ["admin"],
            timezone: "Africa/Lagos",
        };

        service = new AssistantService({
            openAIClient,
            registry,
            interceptor,
            pendingStore,
            audit,
            telemetry,
            clock: () => new Date("2026-10-21T12:00:00.000Z"),
        });
    });

    test("returns an informational message when no tools are available", async () => {
        registry.toolsFor.mockResolvedValue({
            openAITools: [],
            allowed: new Set(),
        });

        await service.interpret({
            message: "Help me",
            userContext,
            onToken,
        });

        expect(openAIClient.propose).not.toHaveBeenCalled();
        expect(onToken).toHaveBeenCalledWith({
            type: "message",
            text: "There are no assistant actions available for your account.",
        });
    });

    test("sends the request, tools, and context to the model client", async () => {
        await service.interpret({
            message: "Find event event-1",
            userContext,
            onToken,
        });

        expect(openAIClient.propose).toHaveBeenCalledWith({
            message: "Find event event-1",
            tools: expect.any(Array),
            signal: undefined,
            context: {
                now: new Date("2026-10-21T12:00:00.000Z"),
                timezone: "Africa/Lagos",
            },
        });
    });

    test("records token usage", async () => {
        await service.interpret({
            message: "Find an event",
            userContext,
            onToken,
        });

        expect(telemetry.counter).toHaveBeenCalledWith(
            "llm_tokens_total",
            10,
            { kind: "prompt" },
        );

        expect(telemetry.counter).toHaveBeenCalledWith(
            "llm_tokens_total",
            5,
            { kind: "completion" },
        );
    });

    test("returns plain text proposals without executing a tool", async () => {
        openAIClient.propose.mockResolvedValue({
            kind: "text",
            text: "I can help you manage events.",
            usage: null,
            promptHash: "hash-123",
        });

        await service.interpret({
            message: "What can you do?",
            userContext,
            onToken,
        });

        expect(audit.record).toHaveBeenCalledWith({
            event: "no_action",
            userId: "user-1",
            tenantId: "tenant-1",
            promptHash: "hash-123",
        });

        expect(interceptor.execute).not.toHaveBeenCalled();

        expect(onToken).toHaveBeenCalledWith({
            type: "message",
            text: "I can help you manage events.",
        });
    });

    test("rejects a tool that was not offered to the model", async () => {
        openAIClient.propose.mockResolvedValue(
            makeProposal({ name: "delete_all_events" }),
        );

        registry.get.mockReturnValue(null);

        await expect(
            service.interpret({
                message: "Delete everything",
                userContext,
                onToken,
            }),
        ).rejects.toBeInstanceOf(LLMUseCaseMappingError);

        expect(telemetry.counter).toHaveBeenCalledWith(
            "llm_unoffered_tool_calls",
            1,
            { tool: "delete_all_events" },
        );

        expect(interceptor.execute).not.toHaveBeenCalled();
    });

    test("rejects invalid tool arguments without executing the tool", async () => {
        openAIClient.propose.mockResolvedValue(
            makeProposal({ args: { event_id: 123 } }),
        );

        await service.interpret({
            message: "Find the event",
            userContext,
            onToken,
        });

        expect(telemetry.counter).toHaveBeenCalledWith(
            "llm_schema_rejections",
            1,
            { tool: "get_event" },
        );

        expect(audit.record).toHaveBeenCalledWith(
            expect.objectContaining({
                event: "schema_rejected",
                tool: "get_event",
                userId: "user-1",
                tenantId: "tenant-1",
            }),
        );

        expect(interceptor.execute).not.toHaveBeenCalled();
    });

    test("authorizes and executes a valid read tool", async () => {
        await service.interpret({
            message: "Find event event-1",
            userContext,
            onToken,
        });

        expect(interceptor.authorize).toHaveBeenCalledWith(
            tool,
            { event_id: "event-1" },
            userContext,
        );

        expect(interceptor.execute).toHaveBeenCalledWith(
            tool,
            { event_id: "event-1" },
            userContext,
            { idempotencyKey: expect.any(String) },
        );

        expect(audit.record).toHaveBeenCalledWith(
            expect.objectContaining({
                event: "executed",
                tool: "get_event",
                userId: "user-1",
                tenantId: "tenant-1",
            }),
        );

        expect(onToken).toHaveBeenCalledWith({
            type: "result",
            tool: "get_event",
            result: {
                event_id: "event-1",
                title: "Test event",
            },
        });
    });

    test("stores confirmation-required actions without executing them", async () => {
        tool.requiresConfirmation = true;
        tool.summarize = jest.fn(() => "Create a conference event");

        openAIClient.propose.mockResolvedValue(
            makeProposal({
                name: "get_event",
                args: { event_id: "event-1" },
            }),
        );

        await service.interpret({
            message: "Create an event",
            userContext,
            onToken,
        });

        expect(pendingStore.save).toHaveBeenCalledWith(
            expect.objectContaining({
                tool: "get_event",
                payload: { event_id: "event-1" },
                userId: "user-1",
                tenantId: "tenant-1",
            }),
            300,
        );

        expect(interceptor.execute).not.toHaveBeenCalled();

        expect(onToken).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "confirmation_required",
                tool: "get_event",
                summary: "Create a conference event",
                expires_in_sec: 300,
            }),
        );
    });

    test("rejects a missing or already-consumed pending action", async () => {
        pendingStore.take.mockResolvedValue(null);

        await expect(
            service.confirm({
                pendingId: "pending-1",
                userContext,
                onToken,
            }),
        ).rejects.toMatchObject({
            code: "PENDING_NOT_FOUND",
        });

        expect(interceptor.execute).not.toHaveBeenCalled();
    });

    test("rejects a pending action belonging to another user or tenant", async () => {
        pendingStore.take.mockResolvedValue({
            id: "pending-1",
            tool: "get_event",
            payload: { event_id: "event-1" },
            userId: "another-user",
            tenantId: "tenant-1",
        });

        await expect(
            service.confirm({
                pendingId: "pending-1",
                userContext,
                onToken,
            }),
        ).rejects.toBeInstanceOf(LLMError);

        expect(interceptor.execute).not.toHaveBeenCalled();
    });

    test("revalidates and executes a valid confirmed action", async () => {
        pendingStore.take.mockResolvedValue({
            id: "pending-1",
            tool: "get_event",
            payload: { event_id: "event-1" },
            userId: "user-1",
            tenantId: "tenant-1",
        });

        await service.confirm({
            pendingId: "pending-1",
            userContext,
            onToken,
        });

        expect(interceptor.authorize).toHaveBeenCalledWith(
            tool,
            { event_id: "event-1" },
            userContext,
        );

        expect(interceptor.execute).toHaveBeenCalledWith(
            tool,
            { event_id: "event-1" },
            userContext,
            { idempotencyKey: "pending-1" },
        );

        expect(audit.record).toHaveBeenCalledWith(
            expect.objectContaining({
                event: "confirmed_executed",
                tool: "get_event",
                pendingId: "pending-1",
            }),
        );
    });

    test("rejects confirmation when the registered tool no longer exists", async () => {
        pendingStore.take.mockResolvedValue({
            id: "pending-1",
            tool: "get_event",
            payload: { event_id: "event-1" },
            userId: "user-1",
            tenantId: "tenant-1",
        });
        registry.get.mockReturnValue(null);

        await expect(
            service.confirm({
                pendingId: "pending-1",
                userContext,
                onToken,
            }),
        ).rejects.toBeInstanceOf(LLMUseCaseMappingError);

        expect(interceptor.authorize).not.toHaveBeenCalled();
        expect(interceptor.execute).not.toHaveBeenCalled();
    });

    test("does not execute a confirmed action whose payload fails revalidation", async () => {
        pendingStore.take.mockResolvedValue({
            id: "pending-1",
            tool: "get_event",
            payload: { event_id: 123 },
            userId: "user-1",
            tenantId: "tenant-1",
        });

        await service.confirm({
            pendingId: "pending-1",
            userContext,
            onToken,
        });

        expect(onToken).toHaveBeenCalledWith({
            type: "message",
            text: expect.stringContaining("This action is no longer valid:"),
        });

        expect(interceptor.authorize).not.toHaveBeenCalled();
        expect(interceptor.execute).not.toHaveBeenCalled();
        expect(audit.record).not.toHaveBeenCalled();
    });

    test("does not execute a confirmed action when authorization fails", async () => {
        pendingStore.take.mockResolvedValue({
            id: "pending-1",
            tool: "get_event",
            payload: { event_id: "event-1" },
            userId: "user-1",
            tenantId: "tenant-1",
        });

        const authorizationError = new Error("Access denied");
        interceptor.authorize.mockRejectedValue(authorizationError);

        await expect(
            service.confirm({
                pendingId: "pending-1",
                userContext,
                onToken,
            }),
        ).rejects.toBe(authorizationError);

        expect(interceptor.execute).not.toHaveBeenCalled();
        expect(audit.record).not.toHaveBeenCalled();
    });

    test("uses the default clock when no clock is injected", async () => {
        const defaultClockService = new AssistantService({
            openAIClient,
            registry,
            interceptor,
            pendingStore,
            audit,
            telemetry,
        });

        await defaultClockService.interpret({
            message: "Find event event-1",
            userContext,
            onToken,
        });

        expect(openAIClient.propose).toHaveBeenCalledWith(
            expect.objectContaining({
                context: expect.objectContaining({
                    now: expect.any(Date),
                    timezone: "Africa/Lagos",
                }),
            }),
        );
    });

    test("uses the default message when a text proposal has no text", async () => {
        openAIClient.propose.mockResolvedValue({
            kind: "text",
            text: "",
            usage: null,
            promptHash: "hash-123",
        });

        await service.interpret({
            message: "Help me",
            userContext,
            onToken,
        });

        expect(onToken).toHaveBeenCalledWith({
            type: "message",
            text: "I can help with viewing, creating, rescheduling and cancelling events.",
        });

        expect(interceptor.execute).not.toHaveBeenCalled();
    });
});
