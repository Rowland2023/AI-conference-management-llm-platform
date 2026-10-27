import { OpenAIClient } from './OpenAIClient.js';
import { ToolRegistry } from './ToolRegistry.js';
import { LLMCommandInterceptor } from './command_interceptor.js';
import { AssistantService } from './AssistantService.js';
import { toolDefinitions } from './tools/index.js';

export function initLLM({ openAIConfig, featureFlags, useCases, accessPolicy, pendingStore, audit, telemetry }) {
  const registry = new ToolRegistry({ featureFlags, definitions: toolDefinitions });

  // Fail at startup, not at the first user request.
  for (const t of registry.list()) {
    const def = registry.get(t.name);
    if (!useCases.has(def.useCase)) throw new Error(`Startup: no use case bound for tool ${def.name} (${def.useCase})`);
  }

  const openAIClient = new OpenAIClient(openAIConfig);
  const interceptor = new LLMCommandInterceptor({
    useCaseRegistry: useCases, featureFlags, telemetryEngine: telemetry, accessPolicy,
  });
  const assistantService = new AssistantService({
    openAIClient, registry, interceptor, pendingStore, audit, telemetry,
  });

  return { assistantService, registry, openAIClient, interceptor };
}
