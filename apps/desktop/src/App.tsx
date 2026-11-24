import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AuthenticationMFAChallenge,
  AuthenticationUser,
  FastBuildClient,
  TokenStore,
} from '@fastbuild/api-client';
import { normalizeApiError } from '@fastbuild/core';
import { BrandMark } from '@fastbuild/ui';
import { SignInScreen } from '@/components/sign-in-screen.tsx';
import { WorkspaceShell, type HealthSnapshot } from '@/components/workspace-shell.tsx';
import {
  createDesktopApiClient,
  loadSavedApiBaseUrl,
  NATIVE_AUTH_PATHS,
  saveApiBaseUrl,
} from '@/lib/api.ts';
import {
  DesktopTokenStore,
  getDesktopBridge,
  type DesktopRuntimeInfo,
  type DesktopThemeMode,
  type FastBuildDesktopBridge,
  type TokenStorageMode,
} from '@/lib/desktop-bridge.ts';
import {
  applyThemeToDocument,
  loadSavedThemeMode,
  resolveShouldUseDark,
  syncThemeWithDesktop,
} from '@/lib/theme.ts';

export interface AppProps {
  readonly bridge?: FastBuildDesktopBridge | null;
  readonly tokenStore?: TokenStore;
  readonly fetchImpl?: typeof globalThis.fetch;
}

const INITIAL_HEALTH: HealthSnapshot = {
  loading: false,
  report: null,
  version: null,
  error: null,
};

function isMfaChallenge(value: unknown): value is AuthenticationMFAChallenge {
  return (
    typeof value === 'object' &&
    value !== null &&
    'mfa_required' in value &&
    (value as { mfa_required?: unknown }).mfa_required === true &&
    'challenge_token' in value &&
    typeof (value as { challenge_token?: unknown }).challenge_token === 'string'
  );
}

export function App({ bridge: bridgeProp, tokenStore: tokenStoreProp, fetchImpl }: AppProps) {
  const bridge = useMemo(
    () => (bridgeProp !== undefined ? bridgeProp : getDesktopBridge()),
    [bridgeProp],
  );
  const tokenStore = useMemo(
    () => tokenStoreProp ?? new DesktopTokenStore(bridge),
    [bridge, tokenStoreProp],
  );

  const [apiBaseUrl, setApiBaseUrl] = useState<string>(() => loadSavedApiBaseUrl());
  const [themeMode, setThemeMode] = useState<DesktopThemeMode>(() => loadSavedThemeMode());
  const [runtimeInfo, setRuntimeInfo] = useState<DesktopRuntimeInfo | null>(null);
  const [user, setUser] = useState<AuthenticationUser | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [health, setHealth] = useState<HealthSnapshot>(INITIAL_HEALTH);

  const handleUnauthorized = useCallback(() => {
    setUser(null);
  }, []);

  const client: FastBuildClient = useMemo(
    () =>
      createDesktopApiClient({
        baseUrl: apiBaseUrl,
        tokenStore,
        onUnauthorized: handleUnauthorized,
        ...(fetchImpl ? { fetch: fetchImpl } : {}),
      }),
    [apiBaseUrl, fetchImpl, handleUnauthorized, tokenStore],
  );

  const refreshHealth = useCallback(async () => {
    setHealth((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const [report, version] = await Promise.all([client.health.check(), client.health.v1()]);
      setHealth({ loading: false, report, version, error: null });
    } catch (error) {
      const normalized = normalizeApiError(error);
      setHealth({
        loading: false,
        report: null,
        version: null,
        error: `${normalized.message} (${normalized.errorCode})`,
      });
    }
  }, [client]);

  // Load desktop runtime info and subscribe to OS theme updates.
  useEffect(() => {
    let active = true;

    if (!bridge) {
      applyThemeToDocument(resolveShouldUseDark(themeMode));
      return () => {
        active = false;
      };
    }

    void bridge
      .getRuntimeInfo()
      .then((info) => {
        if (active) {
          setRuntimeInfo(info);
        }
      })
      .catch(() => {
        // Ignore runtime metadata errors and fall back to defaults.
      });

    void syncThemeWithDesktop(themeMode, bridge).catch(() => {
      applyThemeToDocument(resolveShouldUseDark(themeMode));
    });

    const unsubscribe = bridge.theme.onUpdated((state) => {
      if (active) {
        applyThemeToDocument(state.shouldUseDarkColors);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [bridge, themeMode]);

  // Bootstrap existing bearer session from secure token store on startup.
  useEffect(() => {
    let active = true;

    async function bootstrapSession() {
      try {
        const stored = await tokenStore.getTokens();
        if (!stored?.accessToken) {
          if (active) {
            setUser(null);
          }
          return;
        }
        const profile = await client.user.profile();
        if (active) {
          setUser(profile);
        }
      } catch {
        await tokenStore.clearTokens();
        if (active) {
          setUser(null);
        }
      } finally {
        if (active) {
          setBootstrapping(false);
        }
      }
    }

    void bootstrapSession();

    return () => {
      active = false;
    };
  }, [client, tokenStore]);

  // Refresh health whenever an authenticated session is active.
  useEffect(() => {
    if (!user) {
      return;
    }
    let active = true;

    async function loadHealth() {
      try {
        const [report, version] = await Promise.all([client.health.check(), client.health.v1()]);
        if (active) {
          setHealth({ loading: false, report, version, error: null });
        }
      } catch (error) {
        if (active) {
          const normalized = normalizeApiError(error);
          setHealth({
            loading: false,
            report: null,
            version: null,
            error: `${normalized.message} (${normalized.errorCode})`,
          });
        }
      }
    }

    void loadHealth();

    return () => {
      active = false;
    };
  }, [client, user]);

  const handleSignIn = useCallback(
    async (credentials: { username: string; password: string }) => {
      const result = await client.auth.login(credentials, NATIVE_AUTH_PATHS.login);
      if (isMfaChallenge(result)) {
        return { mfaChallenge: result };
      }
      setUser(result.user);
      return { mfaChallenge: null };
    },
    [client],
  );

  const handleVerifyMfa = useCallback(
    async (payload: { challengeToken: string; code: string }) => {
      const session = await client.auth.mfa.verifyChallenge({
        challenge_token: payload.challengeToken,
        code: payload.code,
      });
      setUser(session.user);
    },
    [client],
  );

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    try {
      await client.auth.logout(NATIVE_AUTH_PATHS.logout);
    } catch {
      // Tokens are cleared in client.auth.logout finally block even on network errors.
    } finally {
      setUser(null);
      setHealth(INITIAL_HEALTH);
      setSigningOut(false);
    }
  }, [client]);

  const handleThemeModeChange = useCallback(
    (nextMode: DesktopThemeMode) => {
      setThemeMode(nextMode);
      void syncThemeWithDesktop(nextMode, bridge).catch(() => {
        applyThemeToDocument(resolveShouldUseDark(nextMode));
      });
    },
    [bridge],
  );

  const handleApiBaseUrlChange = useCallback((nextUrl: string) => {
    const saved = saveApiBaseUrl(nextUrl);
    setApiBaseUrl(saved);
  }, []);

  const storageMode: TokenStorageMode = runtimeInfo
    ? runtimeInfo.storageMode
    : bridge
      ? 'safeStorage'
      : 'browser-memory';

  if (bootstrapping) {
    return (
      <div className="flex min-h-full items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3">
          <BrandMark size="lg" />
          <p className="text-sm text-muted-foreground">Restoring desktop session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <SignInScreen
        apiBaseUrl={apiBaseUrl}
        runtimeLabel={runtimeInfo ? `Electron ${runtimeInfo.electronVersion}` : 'Desktop Preview'}
        storageModeLabel={storageMode}
        onApiBaseUrlChange={handleApiBaseUrlChange}
        onSignIn={handleSignIn}
        onVerifyMfa={handleVerifyMfa}
      />
    );
  }

  return (
    <WorkspaceShell
      user={user}
      apiBaseUrl={apiBaseUrl}
      themeMode={themeMode}
      runtimeInfo={runtimeInfo}
      storageMode={storageMode}
      health={health}
      signingOut={signingOut}
      onRefreshHealth={() => void refreshHealth()}
      onThemeModeChange={handleThemeModeChange}
      onApiBaseUrlChange={handleApiBaseUrlChange}
      onSignOut={() => void handleSignOut()}
    />
  );
}

export default App;
