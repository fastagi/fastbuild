import { useState } from 'react';
import type { ApiVersionHealth, AuthenticationUser, HealthReport } from '@fastbuild/api-client';
import {
  Badge,
  BrandMark,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  SectionHeader,
  StatusDot,
  type StatusTone,
} from '@fastbuild/ui';
import {
  Activity,
  LayoutDashboard,
  LogOut,
  Monitor,
  Moon,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import { DEFAULT_API_BASE_URL, normalizeApiBaseUrl } from '@/lib/api.ts';
import type {
  DesktopRuntimeInfo,
  DesktopThemeMode,
  TokenStorageMode,
} from '@/lib/desktop-bridge.ts';

export type WorkspaceSection = 'overview' | 'settings';

export interface HealthSnapshot {
  readonly loading: boolean;
  readonly report: HealthReport | null;
  readonly version: ApiVersionHealth | null;
  readonly error: string | null;
}

export interface WorkspaceShellProps {
  readonly user: AuthenticationUser;
  readonly apiBaseUrl: string;
  readonly themeMode: DesktopThemeMode;
  readonly runtimeInfo: DesktopRuntimeInfo | null;
  readonly storageMode: TokenStorageMode;
  readonly health: HealthSnapshot;
  readonly signingOut: boolean;
  readonly onRefreshHealth: () => void;
  readonly onThemeModeChange: (mode: DesktopThemeMode) => void;
  readonly onApiBaseUrlChange: (nextUrl: string) => void;
  readonly onSignOut: () => void;
}

const THEME_OPTIONS: readonly {
  readonly value: DesktopThemeMode;
  readonly label: string;
  readonly icon: typeof Sun;
}[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

function healthStatusTone(status: HealthReport['status'] | undefined, error: string | null): StatusTone {
  if (error) {
    return 'danger';
  }
  if (status === 'up') {
    return 'success';
  }
  if (status === 'degraded') {
    return 'warning';
  }
  if (status === 'down') {
    return 'danger';
  }
  return 'neutral';
}

function userStatusLabel(status: AuthenticationUser['status']): string {
  switch (status) {
    case 1:
      return 'Active';
    case 2:
      return 'Pending';
    case 3:
      return 'Banned';
    default:
      return 'Disabled';
  }
}

export function WorkspaceShell({
  user,
  apiBaseUrl,
  themeMode,
  runtimeInfo,
  storageMode,
  health,
  signingOut,
  onRefreshHealth,
  onThemeModeChange,
  onApiBaseUrlChange,
  onSignOut,
}: WorkspaceShellProps) {
  const [section, setSection] = useState<WorkspaceSection>('overview');
  const [endpointDraft, setEndpointDraft] = useState(apiBaseUrl);
  const [endpointNotice, setEndpointNotice] = useState<{
    kind: 'success' | 'error';
    text: string;
  } | null>(null);

  function handleSaveEndpoint() {
    setEndpointNotice(null);
    try {
      const normalized = normalizeApiBaseUrl(endpointDraft);
      onApiBaseUrlChange(normalized);
      setEndpointDraft(normalized);
      setEndpointNotice({ kind: 'success', text: `API base URL updated to ${normalized}` });
    } catch (error) {
      setEndpointNotice({
        kind: 'error',
        text: error instanceof Error ? error.message : 'Invalid API base URL.',
      });
    }
  }

  function handleResetEndpoint() {
    setEndpointDraft(DEFAULT_API_BASE_URL);
    onApiBaseUrlChange(DEFAULT_API_BASE_URL);
    setEndpointNotice({ kind: 'success', text: `Reset to default (${DEFAULT_API_BASE_URL})` });
  }

  const displayName = user.nickname?.trim() || user.username;
  const tone = healthStatusTone(health.report?.status, health.error);
  const healthLabel = health.loading
    ? 'Checking'
    : health.error
      ? 'Unreachable'
      : health.report
        ? health.report.status.toUpperCase()
        : 'Unknown';

  return (
    <div className="flex h-full min-h-screen bg-background text-foreground">
      <aside
        aria-label="Workspace navigation"
        className="flex w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
      >
        <div className="flex items-center gap-2.5 border-b border-sidebar-border px-4 py-3.5">
          <BrandMark size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight">FastBuild</p>
            <p className="truncate text-xs text-sidebar-muted">Desktop</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-2.5">
          <button
            type="button"
            onClick={() => setSection('overview')}
            aria-current={section === 'overview' ? 'page' : undefined}
            className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              section === 'overview'
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-muted hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            <LayoutDashboard className="size-4 shrink-0" aria-hidden="true" />
            Overview
          </button>

          <button
            type="button"
            onClick={() => setSection('settings')}
            aria-current={section === 'settings' ? 'page' : undefined}
            className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              section === 'settings'
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-muted hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            <Settings className="size-4 shrink-0" aria-hidden="true" />
            Settings
          </button>
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="mb-2.5 min-w-0 px-1">
            <p className="truncate text-sm font-medium text-sidebar-foreground">{displayName}</p>
            <p className="truncate text-xs text-sidebar-muted">{user.email}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            loading={signingOut}
            onClick={onSignOut}
            className="w-full justify-start"
          >
            <LogOut className="size-3.5" aria-hidden="true" />
            Sign out
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
          {section === 'overview' ? (
            <>
              <SectionHeader
                eyebrow="Desktop Workspace"
                title="Overview"
                description="Live API connectivity, authenticated native session, and Electron runtime posture."
                actions={
                  <Button
                    variant="outline"
                    size="sm"
                    loading={health.loading}
                    onClick={onRefreshHealth}
                  >
                    <RefreshCw className="size-3.5" aria-hidden="true" />
                    Refresh health
                  </Button>
                }
              />

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Activity className="size-4 text-muted-foreground" aria-hidden="true" />
                        API Health
                      </CardTitle>
                      <StatusDot tone={tone} label={healthLabel} pulse={health.loading} />
                    </div>
                    <CardDescription className="truncate font-mono text-xs">
                      {apiBaseUrl}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {health.error ? (
                      <p className="rounded-md border border-danger/25 bg-danger-subtle px-3 py-2 text-xs text-danger-strong">
                        {health.error}
                      </p>
                    ) : (
                      <dl className="grid grid-cols-2 gap-y-2 text-xs">
                        <dt className="text-muted-foreground">Status</dt>
                        <dd className="font-medium text-foreground">
                          {health.report?.status ?? 'pending'}
                        </dd>
                        <dt className="text-muted-foreground">API Version</dt>
                        <dd className="font-mono text-foreground">
                          {health.version?.version ?? 'v1'}
                        </dd>
                        <dt className="text-muted-foreground">Last checked</dt>
                        <dd className="font-mono text-foreground">
                          {health.report?.timestamp
                            ? new Date(health.report.timestamp).toLocaleTimeString()
                            : '—'}
                        </dd>
                      </dl>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <ShieldCheck className="size-4 text-muted-foreground" aria-hidden="true" />
                        User Session
                      </CardTitle>
                      <Badge variant="secondary">{userStatusLabel(user.status)}</Badge>
                    </div>
                    <CardDescription>Rotating bearer session via native auth</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <dl className="grid grid-cols-2 gap-y-2 text-xs">
                      <dt className="text-muted-foreground">Username</dt>
                      <dd className="font-medium text-foreground">{user.username}</dd>
                      <dt className="text-muted-foreground">Email</dt>
                      <dd className="truncate text-foreground">{user.email}</dd>
                      <dt className="text-muted-foreground">Auth mode</dt>
                      <dd className="font-mono text-foreground">bearer (native)</dd>
                    </dl>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">Desktop Runtime Status</CardTitle>
                    <Badge variant="outline">
                      {runtimeInfo ? `Electron ${runtimeInfo.electronVersion}` : 'Browser Preview'}
                    </Badge>
                  </div>
                  <CardDescription>
                    Process isolation and OS keychain credential storage state.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <dl className="grid gap-3 sm:grid-cols-3 text-xs">
                    <div className="rounded-lg border border-border bg-muted/40 p-3">
                      <dt className="text-muted-foreground">App Version</dt>
                      <dd className="mt-1 font-mono text-sm font-medium text-foreground">
                        {runtimeInfo?.appVersion ?? '0.1.0'}
                      </dd>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/40 p-3">
                      <dt className="text-muted-foreground">Platform</dt>
                      <dd className="mt-1 font-mono text-sm font-medium text-foreground">
                        {runtimeInfo?.platform ?? 'web'}
                      </dd>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/40 p-3">
                      <dt className="text-muted-foreground">Token Storage</dt>
                      <dd className="mt-1 font-mono text-sm font-medium text-foreground">
                        {storageMode}
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              <SectionHeader
                eyebrow="Preferences"
                title="Settings"
                description="Configure appearance, API connection target, and active desktop session."
              />

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Appearance</CardTitle>
                  <CardDescription>
                    Switches between Alabaster light, Obsidian dark, or OS theme synced with
                    Electron nativeTheme.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="inline-flex rounded-lg border border-border bg-muted/50 p-1">
                    {THEME_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      const active = themeMode === option.value;
                      return (
                        <Button
                          key={option.value}
                          variant={active ? 'default' : 'ghost'}
                          size="sm"
                          aria-pressed={active}
                          onClick={() => onThemeModeChange(option.value)}
                        >
                          <Icon className="size-3.5" aria-hidden="true" />
                          {option.label}
                        </Button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">API Base URL</CardTitle>
                  <CardDescription>
                    Target FastBuild API origin used for native bearer authentication and health
                    checks.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      aria-label="API Base URL"
                      type="url"
                      value={endpointDraft}
                      onChange={(event) => setEndpointDraft(event.target.value)}
                      placeholder={DEFAULT_API_BASE_URL}
                      className="font-mono text-xs"
                    />
                    <div className="flex shrink-0 gap-2">
                      <Button onClick={handleSaveEndpoint}>Save</Button>
                      <Button variant="outline" onClick={handleResetEndpoint}>
                        Reset
                      </Button>
                    </div>
                  </div>
                  {endpointNotice ? (
                    <p
                      className={`text-xs ${
                        endpointNotice.kind === 'error'
                          ? 'text-danger-strong'
                          : 'text-success-strong'
                      }`}
                    >
                      {endpointNotice.text}
                    </p>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Session</CardTitle>
                  <CardDescription>
                    Signed in as <span className="font-medium text-foreground">{user.username}</span>{' '}
                    ({user.email}). Signing out revokes the refresh token and clears OS keychain
                    storage.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="destructive" loading={signingOut} onClick={onSignOut}>
                    <LogOut className="size-4" aria-hidden="true" />
                    Sign out
                  </Button>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
