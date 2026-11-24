import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ApiError,
  CLIENT_ERROR_CODES,
  DEFAULT_MESSAGES,
  ERROR_CODES,
  errorCodeToMessageKey,
  I18N_KEYS,
  isApiError,
  isErrorCode,
  isUnauthorizedError,
  isValidEmail,
  isValidSlug,
  normalizeApiError,
  toSlug,
  validateEmail,
  validatePassword,
  validateUsername,
} from './index.ts';

describe('@fastbuild/core errors', () => {
  it('validates canonical error code grammar', () => {
    assert.equal(isErrorCode('AUTH.UNAUTHORIZED'), true);
    assert.equal(isErrorCode('COMMON.VALIDATION_FAILED'), true);
    assert.equal(isErrorCode('not-valid'), false);
    assert.equal(isErrorCode(401), false);
  });

  it('normalizes API error envelopes and detects unauthorized errors', () => {
    const err = normalizeApiError(
      {
        code: 422,
        error_code: ERROR_CODES.COMMON_VALIDATION_FAILED,
        message: 'Validation failed',
        errors: { email: ['is required'] },
        request_id: 'req_abc',
      },
      422,
    );

    assert.equal(isApiError(err), true);
    assert.equal(err.errorCode, ERROR_CODES.COMMON_VALIDATION_FAILED);
    assert.equal(err.status, 422);
    assert.equal(err.requestId, 'req_abc');
    assert.deepEqual(err.fieldErrors, { email: ['is required'] });
    assert.equal(isUnauthorizedError(err), false);

    const unauth = new ApiError('Unauthorized', ERROR_CODES.AUTH_UNAUTHORIZED, { status: 401 });
    assert.equal(isUnauthorizedError(unauth), true);

    const fallback = normalizeApiError(new Error('boom'), 503);
    assert.equal(fallback.errorCode, ERROR_CODES.COMMON_SERVICE_UNAVAILABLE);
    assert.equal(fallback.status, 503);
  });
});

describe('@fastbuild/core validation', () => {
  it('validates emails, passwords, usernames, and slugs', () => {
    assert.equal(isValidEmail('user@example.com'), true);
    assert.equal(isValidEmail('bad-email'), false);
    assert.equal(validateEmail('').valid, false);

    assert.equal(validatePassword('secret123').valid, true);
    assert.equal(validatePassword('123').valid, false);

    assert.equal(validateUsername('fastbuild_dev').valid, true);
    assert.equal(validateUsername('a@b.com').valid, false);
    assert.equal(validateUsername('ab').valid, false);

    assert.equal(toSlug('  Hello, FastBuild World!  '), 'hello-fastbuild-world');
    assert.equal(isValidSlug('hello-fastbuild-world'), true);
    assert.equal(isValidSlug('Invalid_Slug'), false);
  });
});

describe('@fastbuild/core i18n', () => {
  it('maps canonical error codes to shared message keys', () => {
    const key = errorCodeToMessageKey(ERROR_CODES.AUTH_INVALID_CREDENTIALS);
    assert.equal(key, I18N_KEYS.auth.invalidCredentials);
    assert.ok(DEFAULT_MESSAGES[key]);

    assert.equal(
      errorCodeToMessageKey(CLIENT_ERROR_CODES.NETWORK_ERROR),
      I18N_KEYS.common.networkError,
    );
    assert.equal(errorCodeToMessageKey('UNKNOWN.CODE'), I18N_KEYS.common.unknownError);
  });
});
