import { useState, type FormEvent } from 'react';
import {
  isApiError,
  normalizeApiError,
  validatePassword,
  validateUsername,
  type ApiError,
} from '@fastbuild/core';
import {
  Badge,
  BrandMark,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  StatusDot,
} from '@fastbuild/ui';
import { Globe, Lock, User } from 'lucide-react';
import { normalizeApiBaseUrl } from '@/lib/api.ts';

export interface SignInScreenProps {
  readonly apiBaseUrl: string;
  readonly runtimeLabel: string;
  readonly storageModeLabel: string;
  readonly onApiBaseUrlChange: (nextUrl: string) => void;
  readonly onSignIn: (credentials: { username: string; password: string }) => Promise<void>;
}

const VALIDATION_MESSAGES: Record<string, string> = {
  'auth.validation.username_too_short': 'Username must be at least 3 characters.',
  'auth.validation.username_too_long': 'Username must be 50 characters or fewer.',
  'auth.validation.username_no_at': 'Use your username, not an email address.',
  'auth.validation.password_required': 'Password is required.',
  'auth.validation.password_too_short': 'Password must be at least 6 characters.',
  'auth.validation.password_too_long': 'Password must be 50 characters or fewer.',
};

function formatAuthError(error: unknown): { message: string; detail?: string } {
  const normalized: ApiError = isApiError(error) ? error : normalizeApiError(error);
  const parts: string[] = [normalized.errorCode];
  if (normalized.requestId) {
    parts.push(`req ${normalized.requestId}`);
  }
  return {
    message: normalized.message,
    detail: parts.join(' · '),
  };
}

export function SignInScreen({
  apiBaseUrl,
  runtimeLabel,
  storageModeLabel,
  onApiBaseUrlChange,
  onSignIn,
}: SignInScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorState, setErrorState] = useState<{ message: string; detail?: string } | null>(null);
  const [editingEndpoint, setEditingEndpoint] = useState(false);
  const [endpointDraft, setEndpointDraft] = useState(apiBaseUrl);
  const [endpointError, setEndpointError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorState(null);

    const usernameCheck = validateUsername(username);
    if (!usernameCheck.valid) {
      setErrorState({
        message:
          (usernameCheck.reason && VALIDATION_MESSAGES[usernameCheck.reason]) ||
          'Enter a valid username.',
      });
      return;
    }

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      setErrorState({
        message:
          (passwordCheck.reason && VALIDATION_MESSAGES[passwordCheck.reason]) ||
          'Enter a valid password.',
      });
      return;
    }

    setSubmitting(true);
    try {
      await onSignIn({ username: username.trim(), password });
    } catch (error) {
      setErrorState(formatAuthError(error));
    } finally {
      setSubmitting(false);
    }
  }

  function handleSaveEndpoint() {
    setEndpointError(null);
    try {
      const normalized = normalizeApiBaseUrl(endpointDraft);
      onApiBaseUrlChange(normalized);
      setEndpointDraft(normalized);
      setEditingEndpoint(false);
    } catch (error) {
      setEndpointError(error instanceof Error ? error.message : 'Invalid API URL.');
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandMark size="lg" />
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-foreground">
                FastBuild Desktop
              </h1>
              <p className="text-xs text-muted-foreground">Native workstation client</p>
            </div>
          </div>
          <Badge variant="outline">{runtimeLabel}</Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign in to your workspace</CardTitle>
            <CardDescription>
              Authenticate against the FastBuild native bearer endpoint. Tokens are stored via{' '}
              <span className="font-mono text-xs text-foreground">{storageModeLabel}</span>.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit} noValidate>
            <CardContent className="space-y-4">
              {errorState ? (
                <div
                  role="alert"
                  className="rounded-lg border border-danger/30 bg-danger-subtle px-3.5 py-2.5 text-sm text-danger-strong"
                >
                  <p className="font-medium">{errorState.message}</p>
                  {errorState.detail ? (
                    <p className="mt-0.5 font-mono text-xs opacity-80">{errorState.detail}</p>
                  ) : null}
                </div>
              ) : null}

              <div className="space-y-1.5">
                <label
                  htmlFor="desktop-username"
                  className="flex items-center gap-1.5 text-xs font-medium text-foreground"
                >
                  <User className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  Username
                </label>
                <Input
                  id="desktop-username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  disabled={submitting}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="desktop-password"
                  className="flex items-center gap-1.5 text-xs font-medium text-foreground"
                >
                  <Lock className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  Password
                </label>
                <Input
                  id="desktop-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={submitting}
                  required
                />
              </div>
            </CardContent>

            <CardFooter className="flex flex-col items-stretch gap-3">
              <Button type="submit" loading={submitting} className="w-full">
                Sign in
              </Button>

              <div className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Globe className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate font-mono text-foreground">{apiBaseUrl}</span>
                  </span>
                  <button
                    type="button"
                    className="shrink-0 font-medium text-brand hover:underline"
                    onClick={() => {
                      setEndpointDraft(apiBaseUrl);
                      setEndpointError(null);
                      setEditingEndpoint((prev) => !prev);
                    }}
                  >
                    {editingEndpoint ? 'Cancel' : 'Change'}
                  </button>
                </div>

                {editingEndpoint ? (
                  <div className="mt-2.5 space-y-2 border-t border-border pt-2.5">
                    <Input
                      aria-label="API base URL"
                      type="url"
                      value={endpointDraft}
                      onChange={(event) => setEndpointDraft(event.target.value)}
                      placeholder="http://127.0.0.1:8025"
                      className="h-8 text-xs font-mono"
                    />
                    {endpointError ? (
                      <p className="text-xs text-danger-strong">{endpointError}</p>
                    ) : null}
                    <div className="flex justify-end">
                      <Button size="sm" variant="secondary" onClick={handleSaveEndpoint}>
                        Save endpoint
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </CardFooter>
          </form>
        </Card>

        <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
          <StatusDot tone="brand" label="Bearer rotation enabled" />
          <span>Context isolated · Sandboxed</span>
        </div>
      </div>
    </div>
  );
}
