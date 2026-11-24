import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { queryClient } from '@/app/query-client';
import { router } from '@/app/router';
import { recoverCsrfToken } from '@/features/operator-session/hooks/use-operator-session';
import { Toaster } from '@/components/ui/sonner';
import { ThemeSync } from '@/features/preferences/components/theme-sync';
import { useResolvedTheme } from '@/features/preferences/hooks/use-resolved-theme';
import { csrf } from '@/http/client';

csrf.onRejected(recoverCsrfToken);

export function AppProviders() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeSync />
      <RouterProvider router={router} />
      <ThemedToaster />
    </QueryClientProvider>
  );
}

function ThemedToaster() {
  const dark = useResolvedTheme();
  return <Toaster theme={dark ? 'dark' : 'light'} position="bottom-right" />;
}
