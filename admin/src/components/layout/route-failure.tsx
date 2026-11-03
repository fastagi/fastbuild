import { createContext, type ReactNode, useContext } from 'react';
import { cn } from '@/lib/cn';

const InsideConsoleShell = createContext(false);

/** Marks route content as rendered inside the console shell, which owns the `<main>` landmark. */
export function ConsoleShellScope({ children }: { children: ReactNode }) {
  return <InsideConsoleShell.Provider value={true}>{children}</InsideConsoleShell.Provider>;
}

interface RouteFailureProps {
  code?: string;
  title: string;
  description: string;
  detail?: string | undefined;
  /** Announce the failure as it appears, for errors that replace a page the operator was using. */
  alert?: boolean;
  children: ReactNode;
}

/** The layout shared by the 404 and route error pages, inside the console shell or standing alone. */
export function RouteFailure({
  code,
  title,
  description,
  detail,
  alert,
  children,
}: RouteFailureProps) {
  const insideShell = useContext(InsideConsoleShell);
  const Root = insideShell ? 'section' : 'main';

  return (
    <Root
      className={cn('route-failure', !insideShell && 'route-failure-standalone')}
      role={alert ? 'alert' : undefined}
    >
      {code ? <p className="route-failure-code">{code}</p> : null}
      <h1>{title}</h1>
      <p>{description}</p>
      {detail ? <p className="route-failure-detail">{detail}</p> : null}
      <div className="route-failure-actions">{children}</div>
    </Root>
  );
}
