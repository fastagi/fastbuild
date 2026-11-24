import * as React from 'react';
import { cn } from './cn.ts';

interface TabsContextValue {
  readonly baseId: string;
  readonly value: string;
  readonly setValue: (nextValue: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext(componentName: string): TabsContextValue {
  const ctx = React.useContext(TabsContext);
  if (!ctx) {
    throw new Error(`${componentName} must be rendered inside <Tabs>.`);
  }
  return ctx;
}

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  readonly value?: string;
  readonly defaultValue?: string;
  readonly onValueChange?: (value: string) => void;
  readonly ref?: React.Ref<HTMLDivElement>;
}

/** Accessible obsidian pill tabs matching FastBuild Web & Admin Settings styling. */
export function Tabs({
  value: controlledValue,
  defaultValue = '',
  onValueChange,
  className,
  ref,
  children,
  ...props
}: TabsProps) {
  const baseId = React.useId();
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue);
  const value = controlledValue !== undefined ? controlledValue : uncontrolledValue;

  const setValue = React.useCallback(
    (nextValue: string) => {
      if (controlledValue === undefined) {
        setUncontrolledValue(nextValue);
      }
      onValueChange?.(nextValue);
    },
    [controlledValue, onValueChange],
  );

  const contextValue = React.useMemo(
    () => ({ baseId, value, setValue }),
    [baseId, value, setValue],
  );

  return (
    <TabsContext.Provider value={contextValue}>
      <div
        ref={ref}
        data-slot="tabs"
        className={cn('flex flex-col gap-3', className)}
        {...props}
      >
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {
  readonly ref?: React.Ref<HTMLDivElement>;
}

export function TabsList({ className, onKeyDown, ref, ...props }: TabsListProps) {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) {
      return;
    }

    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(event.key)) {
      return;
    }

    const list = event.currentTarget;
    const triggers = Array.from(
      list.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])'),
    );
    if (triggers.length === 0) {
      return;
    }

    const currentIndex = triggers.findIndex((el) => el === document.activeElement);
    if (currentIndex === -1) {
      return;
    }

    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % triggers.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + triggers.length) % triggers.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = triggers.length - 1;
    }

    const nextTrigger = triggers[nextIndex];
    if (nextTrigger) {
      event.preventDefault();
      nextTrigger.focus();
      nextTrigger.click();
    }
  };

  return (
    <div
      ref={ref}
      role="tablist"
      data-slot="tabs-list"
      onKeyDown={handleKeyDown}
      className={cn(
        'inline-flex h-9 w-fit max-w-full items-center justify-start gap-0.5 overflow-x-auto rounded-lg bg-muted p-[3px] text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}

export interface TabsTriggerProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'value'> {
  readonly value: string;
  readonly ref?: React.Ref<HTMLButtonElement>;
}

export function TabsTrigger({
  value,
  className,
  onClick,
  disabled,
  ref,
  ...props
}: TabsTriggerProps) {
  const { baseId, value: activeValue, setValue } = useTabsContext('TabsTrigger');
  const active = activeValue === value;

  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      id={`${baseId}-trigger-${value}`}
      aria-selected={active}
      aria-controls={`${baseId}-content-${value}`}
      tabIndex={active ? 0 : -1}
      disabled={disabled}
      data-slot="tabs-trigger"
      data-state={active ? 'active' : 'inactive'}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented && !disabled) {
          setValue(value);
        }
      }}
      className={cn(
        'inline-flex h-[calc(100%-1px)] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent px-3 py-1 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        'text-muted-foreground hover:text-foreground/80',
        'data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-border',
        'disabled:cursor-not-allowed disabled:opacity-50',
        '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
        className,
      )}
      {...props}
    />
  );
}

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  readonly value: string;
  readonly forceMount?: boolean;
  readonly ref?: React.Ref<HTMLDivElement>;
}

export function TabsContent({
  value,
  forceMount = false,
  className,
  ref,
  children,
  ...props
}: TabsContentProps) {
  const { baseId, value: activeValue } = useTabsContext('TabsContent');
  const active = activeValue === value;

  if (!active && !forceMount) {
    return null;
  }

  return (
    <div
      ref={ref}
      role="tabpanel"
      id={`${baseId}-content-${value}`}
      aria-labelledby={`${baseId}-trigger-${value}`}
      hidden={!active}
      tabIndex={0}
      data-slot="tabs-content"
      data-state={active ? 'active' : 'inactive'}
      className={cn('flex-1 outline-none', className)}
      {...props}
    >
      {children}
    </div>
  );
}
