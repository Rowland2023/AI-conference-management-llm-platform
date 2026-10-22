import { z } from "zod";
import { ToolRegistry } from "../../../src/Shared/Infrastructure/ai/ToolRegistry.js";

describe("ToolRegistry", () => {
    let featureFlags;

    const makeTool = (overrides = {}) => ({
        name: "get_event",
        description: "Get an event",
        zodSchema: z.object({
            event_id: z.string(),
        }),
        useCase: "GetEventUseCase",
        risk: "read",
        requiresRole: ["admin"],
        featureFlag: "ai.events.read",
        ...overrides,
    });

    const makeRegistry = (definitions, flags = featureFlags) =>
        new ToolRegistry({
            featureFlags: flags,
            definitions,
        });

    beforeEach(() => {
        featureFlags = {
            isEnabled: jest.fn().mockResolvedValue(true),
        };
    });

    test("rejects a definition missing a required field", () => {
        const tool = makeTool();
        delete tool.useCase;

        expect(() => makeRegistry([tool]))
            .toThrow(/TOOL_INVALID: get_event missing useCase/);
    });

    test("rejects duplicate tool names", () => {
        expect(() => makeRegistry([makeTool(), makeTool()]))
            .toThrow(/TOOL_DUPLICATE: get_event/);
    });

    test("requires summarize() for confirmation-required tools", () => {
        expect(() => makeRegistry([
            makeTool({
                name: "create_event",
                requiresConfirmation: true,
            }),
        ])).toThrow(/needs summarize\(\) for confirmation/);
    });

    test("accepts a confirmation-required tool with summarize()", () => {
        const summarize = jest.fn(() => "Create event");
        const registry = makeRegistry([
            makeTool({
                name: "create_event",
                requiresConfirmation: true,
                summarize,
            }),
        ]);

        expect(registry.get("create_event").summarize).toBe(summarize);
    });

    test("returns a registered tool", () => {
        const registry = makeRegistry([makeTool()]);

        expect(registry.get("get_event").name).toBe("get_event");
    });

    test("returns null for an unknown tool", () => {
        const registry = makeRegistry([makeTool()]);

        expect(registry.get("unknown_tool")).toBeNull();
    });

    test("offers only tools permitted by role and feature flag", async () => {
        featureFlags.isEnabled.mockImplementation(
            async (flag, tenantId) =>
                flag === "ai.events.read" && tenantId === "tenant-1"
        );

        const registry = makeRegistry([
            makeTool({ requiresRole: ["viewer", "admin"] }),
            makeTool({
                name: "create_event",
                requiresRole: ["admin"],
                featureFlag: "ai.events.write",
                requiresConfirmation: true,
                summarize: () => "Create event",
            }),
        ]);

        const { openAITools, allowed } = await registry.toolsFor({
            id: "user-1",
            tenantId: "tenant-1",
            roles: ["viewer"],
        });

        expect(allowed.has("get_event")).toBe(true);
        expect(allowed.has("create_event")).toBe(false);
        expect(openAITools.map(tool => tool.function.name))
            .toEqual(["get_event"]);
    });

    test("returns no tools when the user has no matching role", async () => {
        const registry = makeRegistry([makeTool()]);

        const result = await registry.toolsFor({
            id: "user-2",
            tenantId: "tenant-1",
            roles: ["attendee"],
        });

        expect(result.openAITools).toEqual([]);
        expect(result.allowed.size).toBe(0);
        expect(featureFlags.isEnabled).not.toHaveBeenCalled();
    });

    test("checks the feature flag using the user's tenant ID", async () => {
        const registry = makeRegistry([makeTool()]);

        await registry.toolsFor({
            id: "user-1",
            tenantId: "tenant-42",
            roles: ["admin"],
        });

        expect(featureFlags.isEnabled).toHaveBeenCalledWith(
            "ai.events.read",
            "tenant-42"
        );
    });

    test("excludes tools when their feature flag is disabled", async () => {
        featureFlags.isEnabled.mockResolvedValue(false);
        const registry = makeRegistry([makeTool()]);

        const result = await registry.toolsFor({
            id: "user-1",
            tenantId: "tenant-1",
            roles: ["admin"],
        });

        expect(result.openAITools).toEqual([]);
        expect(result.allowed.has("get_event")).toBe(false);
    });

    test("returns OpenAI function definitions with parameters", async () => {
        const registry = makeRegistry([makeTool()]);

        const { openAITools } = await registry.toolsFor({
            id: "user-1",
            tenantId: "tenant-1",
            roles: ["admin"],
        });

        expect(openAITools).toHaveLength(1);
        expect(openAITools[0].type).toBe("function");
        expect(openAITools[0].function.name).toBe("get_event");
        expect(openAITools[0].function.description).toBe("Get an event");
        expect(openAITools[0].function.parameters).toBeDefined();
    });

    test("lists metadata without exposing schemas or use cases", () => {
        const registry = makeRegistry([makeTool({ costCents: 5 })]);

        expect(registry.list()).toEqual([
            {
                name: "get_event",
                risk: "read",
                requiresRole: ["admin"],
                featureFlag: "ai.events.read",
                costCents: 5,
            },
        ]);
    });
});
