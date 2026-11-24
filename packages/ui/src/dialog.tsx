import * as React from 'react';
import { cn } from './cn.ts';

interface DialogContextValue {
  readonly open: boolean;
  readonly setOpen: (nextOpen: boolean) => void;
  readonly titleId: string;
  readonly descriptionId: string;
}

const DialogContext = React.createContext<DialogContextValue | null>(null);

function useDialogContext(componentName: string): DialogContextValue {
  const ctx = React.useContext(DialogContext);
  if (!ctx) {
    throw new Error(`${componentName} must be rendered inside <Dialog>.`);
  }
  return ctx;
}

export interface DialogProps {
  readonly open?: boolean;
  readonly defaultOpen?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly children: React.ReactNode;
}

/** Accessible React 19 modal dialog container with controlled and uncontrolled state. */
export function Dialog({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
}: DialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const titleId = React.useId();
  const descriptionId = React.useId();
  const open = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen;

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (controlledOpen === undefined) {
        setUncontrolledOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [controlledOpen, onOpenChange],
  );

  const contextValue = React.useMemo(
    () => ({ open, setOpen, titleId, descriptionId }),
    [open, setOpen, titleId, descriptionId],
  );

  return <DialogContext.Provider value={contextValue}>{children}</DialogContext.Provider>;
}

export interface DialogTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  readonly ref?: React.Ref<HTMLButtonElement>;
}

export function DialogTrigger({ onClick, type = 'button', ref, ...props }: DialogTriggerProps) {
  const { setOpen } = useDialogContext('DialogTrigger');
  return (
    <button
      ref={ref}
      type={type}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          setOpen(true);
        }
      }}
      {...props}
    />
  );
}

export interface DialogCloseProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  readonly ref?: React.Ref<HTMLButtonElement>;
}

export function DialogClose({ onClick, type = 'button', ref, ...props }: DialogCloseProps) {
  const { setOpen } = useDialogContext('DialogClose');
  return (
    <button
      ref={ref}
      type={type}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          setOpen(false);
        }
      }}
      {...props}
    />
  );
}

export interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  readonly closeOnBackdropClick?: boolean;
  readonly showCloseButton?: boolean;
  readonly ref?: React.Ref<HTMLDivElement>;
}

export function DialogContent({
  className,
  children,
  closeOnBackdropClick = true,
  showCloseButton = true,
  ref,
  ...props
}: DialogContentProps) {
  const { open, setOpen, titleId, descriptionId } = useDialogContext('DialogContent');

  React.useEffect(() => {
    if (!open) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, setOpen]);

  if (!open) {
    return null;
  }

  return (
    <div
      data-slot="dialog-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (closeOnBackdropClick && event.target === event.currentTarget) {
          setOpen(false);
        }
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        data-slot="dialog-content"
        className={cn(
          'relative w-full max-w-lg rounded-xl border border-border bg-card p-6 text-card-foreground shadow-lg',
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton ? (
          <button
            type="button"
            aria-label="Close dialog"
            onClick={() => setOpen(false)}
            className="absolute right-4 top-4 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        ) : null}
      </div>
    </div>
  );
}

export interface DialogHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  readonly ref?: React.Ref<HTMLDivElement>;
}

export function DialogHeader({ className, ref, ...props }: DialogHeaderProps) {
  return (
    <div
      ref={ref}
      className={cn('flex flex-col space-y-1.5 text-left', className)}
      {...props}
    />
  );
}

export interface DialogFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  readonly ref?: React.Ref<HTMLDivElement>;
}

export function DialogFooter({ className, ref, ...props }: DialogFooterProps) {
  return (
    <div
      ref={ref}
      className={cn('mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  );
}

export interface DialogTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  readonly ref?: React.Ref<HTMLHeadingElement>;
}

export function DialogTitle({ className, ref, ...props }: DialogTitleProps) {
  const { titleId } = useDialogContext('DialogTitle');
  return (
    <h2
      ref={ref}
      id={titleId}
      className={cn('text-base font-semibold leading-none tracking-tight text-foreground', className)}
      {...props}
    />
  );
}

export interface DialogDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  readonly ref?: React.Ref<HTMLParagraphElement>;
}

export function DialogDescription({ className, ref, ...props }: DialogDescriptionProps) {
  const { descriptionId } = useDialogContext('DialogDescription');
  return (
    <p
      ref={ref}
      id={descriptionId}
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}
