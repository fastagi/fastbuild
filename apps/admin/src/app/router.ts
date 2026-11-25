import { createRouter } from '@tanstack/react-router';
import { queryClient, registerUnauthorizedHandler } from '@/app/query-client';
import { RouteErrorPage } from '@/components/layout/route-error-page';
import { RoutePending } from '@/components/layout/route-pending';
import { routeTree } from '@/routeTree.gen';

const basepath =
  import.meta.env.BASE_URL === '/' ? '/' : import.meta.env.BASE_URL.replace(/\/$/, '');

export const router = createRouter({
  routeTree,
  basepath,
  context: {
    queryClient,
  },
  defaultErrorComponent: RouteErrorPage,
  defaultPendingComponent: RoutePending,
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
});

registerUnauthorizedHandler(() => {
  const currentPath = router.state.location.pathname;
  if (currentPath === '/login') {
    return;
  }
  queryClient.setQueryData(['operator', 'session'], null);
  void router.navigate({
    to: '/login',
    search: { redirect: router.state.location.href },
    replace: true,
  });
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
