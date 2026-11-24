import * as React from 'react';
import type { AuthenticationUser, FastBuildClient } from '@fastbuild/api-client';
import { getInitialApiBaseUrl, normalizeApiBaseUrl } from '../config/env';
import {
  createMobileApiClient,
  restoreNativeSession,
  signInNative,
  signOutNative,
} from './native-session';
import { SecureTokenStore } from './secure-token-store';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthContextValue {
  readonly status: AuthStatus;
  readonly user: AuthenticationUser | null;
  readonly apiBaseUrl: string;
  readonly client: FastBuildClient;
  readonly setApiBaseUrl: (url: string) => void;
  readonly signIn: (username: string, password: string) => Promise<AuthenticationUser>;
  readonly signOut: () => Promise<void>;
  readonly refreshProfile: () => Promise<AuthenticationUser | null>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  readonly children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const tokenStoreRef = React.useRef<SecureTokenStore | null>(null);
  if (!tokenStoreRef.current) {
    tokenStoreRef.current = new SecureTokenStore();
  }
  const tokenStore = tokenStoreRef.current;

  const [apiBaseUrl, setApiBaseUrlState] = React.useState<string>(() => getInitialApiBaseUrl());
  const [status, setStatus] = React.useState<AuthStatus>('loading');
  const [user, setUser] = React.useState<AuthenticationUser | null>(null);

  const handleUnauthorized = React.useCallback(async () => {
    await tokenStore.clearTokens();
    setUser(null);
    setStatus('unauthenticated');
  }, [tokenStore]);

  const client = React.useMemo(
    () =>
      createMobileApiClient({
        baseUrl: apiBaseUrl,
        tokenStore,
        onUnauthorized: handleUnauthorized,
      }),
    [apiBaseUrl, tokenStore, handleUnauthorized],
  );

  React.useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const restored = await restoreNativeSession(client, tokenStore);
        if (cancelled) {
          return;
        }
        if (restored) {
          setUser(restored);
          setStatus('authenticated');
        } else {
          setUser(null);
          setStatus('unauthenticated');
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setStatus('unauthenticated');
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [client, tokenStore]);

  const setApiBaseUrl = React.useCallback((nextUrl: string) => {
    setApiBaseUrlState(normalizeApiBaseUrl(nextUrl));
  }, []);

  const signIn = React.useCallback(
    async (username: string, password: string): Promise<AuthenticationUser> => {
      const session = await signInNative(client, { username, password });
      setUser(session.user);
      setStatus('authenticated');
      return session.user;
    },
    [client],
  );

  const signOut = React.useCallback(async (): Promise<void> => {
    await signOutNative(client, tokenStore);
    setUser(null);
    setStatus('unauthenticated');
  }, [client, tokenStore]);

  const refreshProfile = React.useCallback(async (): Promise<AuthenticationUser | null> => {
    const profile = await restoreNativeSession(client, tokenStore);
    setUser(profile);
    setStatus(profile ? 'authenticated' : 'unauthenticated');
    return profile;
  }, [client, tokenStore]);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      apiBaseUrl,
      client,
      setApiBaseUrl,
      signIn,
      signOut,
      refreshProfile,
    }),
    [status, user, apiBaseUrl, client, setApiBaseUrl, signIn, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return ctx;
}
