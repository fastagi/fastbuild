import * as React from 'react';
import { cn } from './cn.ts';

export interface SwitchProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  readonly checked?: boolean;
  readonly defaultChecked?: boolean;
  readonly onCheckedChange?: (checked: boolean) => void;
  readonly ref?: React.Ref<HTMLButtonElement>;
}

/** Accessible binary toggle switch using zero-chroma obsidian/alabaster tokens. */
export function Switch({
  checked: controlledChecked,
  defaultChecked = false,
  onCheckedChange,
  disabled,
  className,
  onClick,
  ref,
  ...props
}: SwitchProps) {
  const [uncontrolledChecked, setUncontrolledChecked] = React.useState(defaultChecked);
  const checked = controlledChecked !== undefined ? controlledChecked : uncontrolledChecked;

  function toggle() {
    if (disabled) {
      return;
    }
    const next = !checked;
    if (controlledChecked === undefined) {
      setUncontrolledChecked(next);
    }
    onCheckedChange?.(next);
  }

  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      data-state={checked ? 'checked' : 'unchecked'}
      disabled={disabled}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          toggle();
        }
      }}
      className={cn(
        'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-input',
        className,
      )}
      {...props}
    >
      <span
        data-state={checked ? 'checked' : 'unchecked'}
        className={cn(
          'pointer-events-none block size-4 rounded-full bg-background shadow-sm ring-0 transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0',
        )}
      />
    </button>
  );
}
