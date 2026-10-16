export class LLMError extends Error {
  constructor(code, message, { cause } = {}) {
    super(message, { cause });
    this.name = 'LLMError';
    this.code = code;
  }
}
export class LLMAuthorizationError extends LLMError {
  constructor(m) { super('LLM_UNAUTHORIZED', m); }
}
export class LLMFeatureDisabledError extends LLMError {
  constructor(m) { super('LLM_FEATURE_DISABLED', m); }
}
export class LLMResourceAccessError extends LLMError {
  constructor(m) { super('LLM_RESOURCE_FORBIDDEN', m); }
}
export class LLMUseCaseMappingError extends LLMError {
  constructor(m) { super('LLM_USE_CASE_MAPPING', m); }
}