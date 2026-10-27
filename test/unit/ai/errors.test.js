import {
    LLMError,
    LLMAuthorizationError,
    LLMFeatureDisabledError,
    LLMResourceAccessError,
    LLMUseCaseMappingError,
} from '../../../src/Shared/Infrastructure/ai/errors.js';


describe('LLM errors', () => {
    test('LLMError stores its code, message, and name', () => {
        const error = new LLMError('TEST_CODE', 'Test failure');

        expect(error).toBeInstanceOf(Error);
        expect(error.name).toBe('LLMError');
        expect(error.code).toBe('TEST_CODE');
        expect(error.message).toBe('Test failure');
    });

    test('LLMError preserves an optional cause', () => {
        const cause = new Error('Underlying failure');
        const error = new LLMError('TEST_CODE', 'Wrapped failure', { cause });

        expect(error.cause).toBe(cause);
    });

    test.each([
        [LLMAuthorizationError, 'LLM_UNAUTHORIZED'],
        [LLMFeatureDisabledError, 'LLM_FEATURE_DISABLED'],
        [LLMResourceAccessError, 'LLM_RESOURCE_FORBIDDEN'],
        [LLMUseCaseMappingError, 'LLM_USE_CASE_MAPPING'],
    ])('%s exposes the expected code and message', (ErrorClass, expectedCode) => {
        const error = new ErrorClass('Specific failure');

        expect(error).toBeInstanceOf(LLMError);
        expect(error.code).toBe(expectedCode);
        expect(error.message).toBe('Specific failure');
    });
});
