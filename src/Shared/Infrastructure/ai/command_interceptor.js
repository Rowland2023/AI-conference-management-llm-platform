import { performance } from 'node:perf_hooks';
import {
  LLMAuthorizationError, LLMFeatureDisabledError, LLMUseCaseMappingError,
} from './errors.js';

export class LLMCommandInterceptor {
  constructor({ useCaseRegistry, featureFlags, telemetryEngine, accessPolicy }) {
    if (!useCaseRegistry || !featureFlags || !telemetryEngine || !accessPolicy) {
      throw new Error('LLMCommandInterceptor: missing dependencies');
    }
    this.useCases = useCaseRegistry;       // Map<string, { execute(payload, user) }>
    this.featureFlags = featureFlags;
    this.telemetry = telemetryEngine;
    this.accessPolicy = accessPolicy;      // { assertConferenceAccess(user, conferenceId) }
  }

  /** Runs at propose time AND again at confirm time (roles/flags may have changed). */
  async authorize(toolDef, payload, user) {
    if (!(await this.featureFlags.isEnabled(toolDef.featureFlag, user.tenantId))) {
      this.telemetry.counter('llm_feature_gate_rejections', 1, { tool: toolDef.name });
      throw new LLMFeatureDisabledError('This action is currently disabled.');
    }
    if (!toolDef.requiresRole.some(r => user.roles.includes(r))) {
      this.telemetry.emitAlert('LLM_UNAUTHORIZED_TOOL_ATTEMPT', { tool: toolDef.name, userId: user.id });
      throw new LLMAuthorizationError('You are not permitted to perform this action.');
    }
    if (payload.conference_id) {
      await this.accessPolicy.assertConferenceAccess(user, payload.conference_id); // throws LLMResourceAccessError
    }
  }

  async execute(toolDef, payload, user, { idempotencyKey }) {
    const useCase = this.useCases.get(toolDef.useCase);
    if (!useCase) throw new LLMUseCaseMappingError(`No use case bound for ${toolDef.name}`);

    const input = toolDef.risk === 'read' ? payload : { ...payload, idempotency_key: idempotencyKey };
    const t0 = performance.now();
    try {
      // Use cases must scope every query by user.tenantId, also for event_id-only lookups.
      const result = await useCase.execute(input, user);
      const ms = performance.now() - t0;
      this.telemetry.histogram('llm_tool_duration_ms', ms, { tool: toolDef.name });
      if (ms > toolDef.slaMs) this.telemetry.counter('llm_sla_breach_count', 1, { tool: toolDef.name });
      return result;
    } catch (err) {
      this.telemetry.counter('llm_tool_failures', 1, { tool: toolDef.name, errorClass: err.name ?? 'Unknown' });
      throw err;
    }
  }
}