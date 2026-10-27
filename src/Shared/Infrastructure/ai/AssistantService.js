import crypto from 'node:crypto';
import { LLMError, LLMUseCaseMappingError } from './errors.js';

const PENDING_TTL_SEC = 300;

export class AssistantService {
  constructor({ openAIClient, registry, interceptor, pendingStore, audit, telemetry, clock = () => new Date() }) {
    Object.assign(this, { openAIClient, registry, interceptor, pendingStore, audit, telemetry, clock });
  }

  async interpret({ message, userContext, onToken, signal }) {
    const emit = (e) => onToken?.(e);
    const user = userContext;

    const { openAITools, allowed } = await this.registry.toolsFor(user);
    if (openAITools.length === 0) {
      emit({ type: 'message', text: 'There are no assistant actions available for your account.' });
      return;
    }

    emit({ type: 'status', text: 'thinking' });
    signal?.throwIfAborted();

    const proposal = await this.openAIClient.propose({
      message, tools: openAITools, signal,
      context: { now: this.clock(), timezone: user.timezone },
    });
    this.#recordUsage(proposal.usage);

    if (proposal.kind === 'text') {
      await this.audit.record({ event: 'no_action', userId: user.id, tenantId: user.tenantId, promptHash: proposal.promptHash });
      emit({ type: 'message', text: proposal.text || 'I can help with viewing, creating, rescheduling and cancelling events.' });
      return;
    }

    // The model may only call tools it was offered.
    const def = this.registry.get(proposal.name);
    if (!def || !allowed.has(proposal.name)) {
      this.telemetry.counter('llm_unoffered_tool_calls', 1, { tool: proposal.name });
      throw new LLMUseCaseMappingError('Model requested a tool that was not offered.');
    }

    const parsed = def.zodSchema.safeParse(proposal.args);
    if (!parsed.success) {
      this.telemetry.counter('llm_schema_rejections', 1, { tool: def.name });
      await this.audit.record({ event: 'schema_rejected', tool: def.name, userId: user.id, tenantId: user.tenantId, promptHash: proposal.promptHash });
      emit({ type: 'message', text: `I couldn't build a valid request: ${parsed.error.issues.map(i => i.message).join('; ')}` });
      return;
    }
    const payload = parsed.data;

    await this.interceptor.authorize(def, payload, user);

    if (def.requiresConfirmation) {
      const id = crypto.randomUUID();
      await this.pendingStore.save(
        { id, tool: def.name, payload, userId: user.id, tenantId: user.tenantId, createdAt: Date.now() },
        PENDING_TTL_SEC,
      );
      await this.audit.record({ event: 'proposed', tool: def.name, pendingId: id, userId: user.id, tenantId: user.tenantId, promptHash: proposal.promptHash });
      emit({ type: 'confirmation_required', pending_id: id, tool: def.name, summary: def.summarize(payload), expires_in_sec: PENDING_TTL_SEC });
      return;
    }

    const result = await this.interceptor.execute(def, payload, user, { idempotencyKey: crypto.randomUUID() });
    await this.audit.record({ event: 'executed', tool: def.name, userId: user.id, tenantId: user.tenantId, promptHash: proposal.promptHash });
    emit({ type: 'result', tool: def.name, result });
  }

  async confirm({ pendingId, userContext, onToken }) {
    const emit = (e) => onToken?.(e);
    const user = userContext;

    const pending = await this.pendingStore.take(pendingId); // atomic, single use
    if (!pending || pending.userId !== user.id || pending.tenantId !== user.tenantId) {
      throw new LLMError('PENDING_NOT_FOUND', 'This action expired or was already used.');
    }
    const def = this.registry.get(pending.tool);
    if (!def) throw new LLMUseCaseMappingError('Tool no longer exists.');

    // Re-validate: e.g. "start_time must be in the future" may no longer hold.
    const parsed = def.zodSchema.safeParse(pending.payload);
    if (!parsed.success) {
      emit({ type: 'message', text: `This action is no longer valid: ${parsed.error.issues.map(i => i.message).join('; ')}` });
      return;
    }
    await this.interceptor.authorize(def, parsed.data, user);
    const result = await this.interceptor.execute(def, parsed.data, user, { idempotencyKey: pending.id });
    await this.audit.record({ event: 'confirmed_executed', tool: def.name, pendingId: pending.id, userId: user.id, tenantId: user.tenantId });
    emit({ type: 'result', tool: def.name, result });
  }

  #recordUsage(usage) {
    if (!usage) return;
    this.telemetry.counter('llm_tokens_total', usage.prompt_tokens, { kind: 'prompt' });
    this.telemetry.counter('llm_tokens_total', usage.completion_tokens, { kind: 'completion' });
  }
}