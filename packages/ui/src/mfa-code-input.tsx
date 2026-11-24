import * as React from 'react';
import { cn } from './cn.ts';

export interface MfaCodeInputProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onComplete?: (code: string) => void;
  readonly length?: number;
  readonly disabled?: boolean;
  readonly autoFocus?: boolean;
  readonly invalid?: boolean;
  readonly id?: string;
  readonly ariaLabel?: string;
  readonly className?: string;
}

function sanitizeDigits(raw: string, maxLength: number): string {
  return raw.replace(/\D/g, '').slice(0, maxLength);
}

/** 6-digit TOTP OTP input with single-character boxes, paste support, and keyboard navigation. */
export function MfaCodeInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled = false,
  autoFocus = false,
  invalid = false,
  id,
  ariaLabel = 'One-time verification code',
  className,
}: MfaCodeInputProps) {
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);
  const normalized = sanitizeDigits(value, length);
  const digits = Array.from({ length }, (_, index) => normalized[index] ?? '');

  React.useEffect(() => {
    if (autoFocus && !disabled) {
      inputRefs.current[0]?.focus();
    }
  }, [autoFocus, disabled]);

  function focusIndex(index: number) {
    const clamped = Math.max(0, Math.min(length - 1, index));
    inputRefs.current[clamped]?.focus();
    inputRefs.current[clamped]?.select();
  }

  function commit(nextDigits: string[], nextFocusIndex?: number) {
    const joined = sanitizeDigits(nextDigits.join(''), length);
    onChange(joined);
    if (nextFocusIndex !== undefined) {
      focusIndex(nextFocusIndex);
    }
    if (joined.length === length) {
      onComplete?.(joined);
    }
  }

  function handleChange(index: number, rawInput: string) {
    const cleaned = sanitizeDigits(rawInput, length);
    if (!cleaned) {
      const next = [...digits];
      next[index] = '';
      commit(next);
      return;
    }

    if (cleaned.length > 1) {
      const next = [...digits];
      for (let offset = 0; offset < cleaned.length && index + offset < length; offset += 1) {
        next[index + offset] = cleaned[offset] ?? '';
      }
      const focusTarget = Math.min(index + cleaned.length, length - 1);
      commit(next, focusTarget);
      return;
    }

    const next = [...digits];
    next[index] = cleaned[0] ?? '';
    commit(next, index < length - 1 ? index + 1 : index);
  }

  function handleKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace') {
      event.preventDefault();
      const next = [...digits];
      if (next[index]) {
        next[index] = '';
        commit(next, index);
      } else if (index > 0) {
        next[index - 1] = '';
        commit(next, index - 1);
      }
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusIndex(index - 1);
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusIndex(index + 1);
    }
  }

  function handlePaste(index: number, event: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = sanitizeDigits(event.clipboardData.getData('text'), length);
    if (!pasted) {
      return;
    }
    event.preventDefault();
    const start = pasted.length >= length ? 0 : index;
    const next = [...digits];
    for (let offset = 0; offset < pasted.length && start + offset < length; offset += 1) {
      next[start + offset] = pasted[offset] ?? '';
    }
    const focusTarget = Math.min(start + pasted.length, length - 1);
    commit(next, focusTarget);
  }

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn('flex items-center justify-between gap-2', className)}
    >
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(node) => {
            inputRefs.current[index] = node;
          }}
          id={index === 0 ? id : undefined}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          aria-label={`Digit ${index + 1} of ${length}`}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          value={digit}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={(event) => handlePaste(index, event)}
          onFocus={(event) => event.currentTarget.select()}
          className={cn(
            'flex h-11 w-10 flex-1 rounded-md border bg-transparent text-center font-mono text-lg font-semibold text-foreground shadow-sm tabular-nums transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
            invalid ? 'border-danger focus-visible:ring-danger' : 'border-input',
          )}
        />
      ))}
    </div>
  );
}
