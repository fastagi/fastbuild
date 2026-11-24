import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { fireEvent, render, screen } from '@testing-library/react';
import { router as appRouter } from '@/app/router';
import { RouteErrorPage } from '@/components/layout/route-error-page';
import { RoutePending } from '@/components/layout/route-pending';
import { ApiError } from '@/http/client';
import { ApiErrorCode } from '@/http/codes';
import '@/i18n';

function renderRoutes(
  loader: () => Promise<unknown> | unknown,
  component: () => React.ReactNode = () => <p>Console home</p>,
) {
  const rootRoute = createRootRoute({ component: Outlet });
  const consoleRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/console',
    loader,
    component,
  });
  const loginRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/login',
    component: function Login() {
      const search = loginRoute.useSearch() as { redirect?: string };
      return <p>Sign in to continue {search.redirect}</p>;
    },
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([consoleRoute, loginRoute]),
    history: createMemoryHistory({ initialEntries: ['/console'] }),
    defaultErrorComponent: RouteErrorPage,
    defaultPendingComponent: RoutePending,
    defaultPendingMs: 0,
  });
  render(<RouterProvider router={router} />);
  return router;
}

describe('RouteErrorPage', () => {
  it('is the application router default for errors and pending routes', () => {
    expect(appRouter.options.defaultErrorComponent).toBe(RouteErrorPage);
    expect(appRouter.options.defaultPendingComponent).toBe(RoutePending);
  });

  it('shows translated copy and the request id instead of the upstream message', async () => {
    renderRoutes(() => {
      throw new ApiError('database exploded', ApiErrorCode.COMMON_INTERNAL, {
        requestId: 'req_123',
        status: 500,
      });
    });

    expect(await screen.findByRole('heading', { name: 'Something went wrong' })).toBeVisible();
    expect(screen.getByText('Request ID: req_123')).toBeVisible();
    expect(screen.queryByText('database exploded')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to console/i })).toHaveAttribute(
      'href',
      '/console',
    );
  });

  it('catches a route component that throws while rendering', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderRoutes(
      () => null,
      () => {
        throw new Error('render failure');
      },
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.queryByText(/Request ID/)).not.toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it('retries the failed route loader', async () => {
    const loader = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('Unable to reach the API', 'CLIENT.NETWORK_ERROR'))
      .mockResolvedValue(null);
    renderRoutes(loader);

    fireEvent.click(await screen.findByRole('button', { name: /try again/i }));

    expect(await screen.findByText('Console home')).toBeVisible();
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('redirects an expired operator session to sign-in instead of showing the boundary', async () => {
    renderRoutes(() => {
      throw new ApiError('Unauthorized', ApiErrorCode.AUTH_UNAUTHORIZED, { status: 401 });
    });

    expect(await screen.findByText('Sign in to continue /console')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders the pending skeleton while a loader is running', async () => {
    renderRoutes(() => new Promise(() => {}));

    expect(await screen.findByRole('status')).toHaveTextContent('Loading…');
  });
});
