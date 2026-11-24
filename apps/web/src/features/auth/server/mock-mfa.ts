import 'server-only';

import type {
  AuthUser,
  MfaStatusResponse,
  MfaTotpEnrollResponse,
  MfaTotpVerifyResponse,
} from '@/features/auth/types';

interface MockMfaRecord {
  enabled: boolean;
  secret: string;
  enrolledAt?: string;
  recoveryCodes: string[];
}

const mockMfaStore = new Map<string, MockMfaRecord>();

function generateMockSecret(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let result = '';
  for (let i = 0; i < 32; i += 1) {
    result += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return result;
}

function generateMockRecoveryCodes(): string[] {
  return Array.from({ length: 8 }, (_, index) => {
    const partA = String(1000 + index * 111).slice(0, 4);
    const partB = String(5000 + index * 137).slice(0, 4);
    return `${partA}-${partB}`;
  });
}

export function getMockMfaStatus(userId: string): MfaStatusResponse {
  const record = mockMfaStore.get(userId);
  if (!record || !record.enabled) {
    return {
      enabled: false,
      method: 'totp',
      remaining_recovery_codes: 0,
    };
  }

  return {
    enabled: true,
    method: 'totp',
    remaining_recovery_codes: record.recoveryCodes.length,
    ...(record.enrolledAt ? { enrolled_at: record.enrolledAt } : {}),
  };
}

export function enrollMockMfaTotp(user: AuthUser): MfaTotpEnrollResponse | null {
  const existing = mockMfaStore.get(user.id);
  if (existing?.enabled) {
    return null;
  }

  const secret = generateMockSecret();
  mockMfaStore.set(user.id, {
    enabled: false,
    secret,
    recoveryCodes: [],
  });

  const issuer = 'FastBuild';
  const label = encodeURIComponent(`${issuer}:${user.email}`);
  const otpauth_uri = `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

  return {
    secret,
    otpauth_uri,
    issuer,
    account_name: user.email,
  };
}

export function verifyMockMfaTotp(
  userId: string,
  code: string
): MfaTotpVerifyResponse | 'not_pending' | 'invalid_code' {
  const record = mockMfaStore.get(userId);
  if (!record || record.enabled) {
    return 'not_pending';
  }

  if (!/^\d{6}$/.test(code.trim())) {
    return 'invalid_code';
  }

  const recoveryCodes = generateMockRecoveryCodes();
  mockMfaStore.set(userId, {
    ...record,
    enabled: true,
    enrolledAt: new Date().toISOString(),
    recoveryCodes,
  });

  return {
    enabled: true,
    recovery_codes: recoveryCodes,
  };
}

export function disableMockMfaTotp(
  userId: string,
  code: string
): { enabled: false } | 'not_enabled' | 'invalid_code' {
  const record = mockMfaStore.get(userId);
  if (!record || !record.enabled) {
    return 'not_enabled';
  }

  const normalized = code.trim();
  if (!/^\d{6}$/.test(normalized) && !record.recoveryCodes.includes(normalized)) {
    return 'invalid_code';
  }

  mockMfaStore.delete(userId);
  return { enabled: false };
}
