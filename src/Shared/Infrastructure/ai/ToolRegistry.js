import { zodToJsonSchema } from 'zod-to-json-schema';

const REQUIRED = ['name', 'description', 'zodSchema', 'useCase', 'risk', 'requiresRole', 'featureFlag'];

export class ToolRegistry {
  #tools = new Map();

  constructor({ featureFlags, definitions }) {
    if (!featureFlags) throw new Error('ToolRegistry: featureFlags required');
    this.featureFlags = featureFlags;
    definitions.forEach(d => this.register(d));
  }

  register(def) {
    for (const f of REQUIRED) {
      if (def[f] === undefined) throw new Error(`TOOL_INVALID: ${def.name ?? '?'} missing ${f}`);
    }
    if (this.#tools.has(def.name)) throw new Error(`TOOL_DUPLICATE: ${def.name}`);
    if (def.requiresConfirmation && typeof def.summarize !== 'function') {
      throw new Error(`TOOL_INVALID: ${def.name} needs summarize() for confirmation`);
    }
    const { $schema, ...parameters } = zodToJsonSchema(def.zodSchema, {
      target: 'openApi3',
      $refStrategy: 'none',
    });
    this.#tools.set(def.name, { ...def, parameters });
  }

  get(name) { return this.#tools.get(name) ?? null; }

  /** Tools this user may be offered right now (role + per-tenant flag). */
  async toolsFor(user) {
    const openAITools = [];
    const allowed = new Set();
    for (const def of this.#tools.values()) {
      if (!def.requiresRole.some(r => user.roles.includes(r))) continue;
      if (!(await this.featureFlags.isEnabled(def.featureFlag, user.tenantId))) continue;
      allowed.add(def.name);
      openAITools.push({
        type: 'function',
        function: { name: def.name, description: def.description, parameters: def.parameters },
      });
    }
    return { openAITools, allowed };
  }

  list() {
    return [...this.#tools.values()].map(({ name, risk, requiresRole, featureFlag, costCents }) =>
      ({ name, risk, requiresRole, featureFlag, costCents }));
  }
}