import * as React from 'react';
import { Button } from './button.tsx';
import { cn } from './cn.ts';

export interface RecoveryCodesGridProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onCopy'> {
  readonly codes: readonly string[];
  readonly copyLabel?: string;
  readonly copiedLabel?: string;
  readonly onCopy?: (joinedCodes: string) => void;
}

/** 2-column monospace grid for one-time MFA recovery codes with a copy-all action. */
export function RecoveryCodesGrid({
  codes,
  copyLabel = 'Copy all',
  copiedLabel = 'Copied',
  onCopy,
  className,
  ...props
}: RecoveryCodesGridProps) {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function handleCopyAll() {
    const text = codes.join('\n');
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
      setCopied(true);
      onCopy?.(text);
    } catch {
      onCopy?.(text);
    }
  }

  return (
    <div
      className={cn('space-y-3 rounded-xl border border-border bg-muted/40 p-4', className)}
      {...props}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          One-time recovery codes ({codes.length})
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void handleCopyAll()}
          disabled={codes.length === 0}
        >
          {copied ? (
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-3.5"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          ) : (
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-3.5"
            >
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
            </svg>
          )}
          {copied ? copiedLabel : copyLabel}
        </Button>
      </div>

      <ul
        aria-label="Recovery codes"
        className="grid grid-cols-2 gap-2"
      >
        {codes.map((code, index) => (
          <li
            key={`${code}-${index}`}
            className="rounded-md border border-border bg-background px-3 py-2 text-center font-mono text-xs font-medium tracking-wider text-foreground tabular-nums select-all"
          >
            {code}
          </li>
        ))}
      </ul>
    </div>
  );
}
