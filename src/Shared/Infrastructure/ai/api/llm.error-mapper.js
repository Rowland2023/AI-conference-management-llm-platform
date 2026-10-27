import { LLMError } from './llm/errors.js';

const STATUS_BY_CODE = {
  LLM_UNAUTHORIZED: 403,
  LLM_RESOURCE_FORBIDDEN: 403,
  LLM_FEATURE_DISABLED: 403,
  PENDING_NOT_FOUND: 410,
  PROMPT_TOO_LARGE: 413,
  LLM_UNAVAILABLE: 503,
  LLM_PROVIDER_ERROR: 502,
  LLM_JSON_INVALID: 502,
  LLM_MULTIPLE_TOOL_CALLS: 502,
  LLM_USE_CASE_MAPPING: 500,
};

/** Returns { status, body } for LLMError, or null so other handlers can take over. */
export function mapLLMError(err) {
  if (!(err instanceof LLMError)) return null;
  return {
    status: STATUS_BY_CODE[err.code] ?? 500,
    body: { error: err.code, message: err.message },
  };
}