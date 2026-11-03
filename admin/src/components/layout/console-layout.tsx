import { Outlet } from '@tanstack/react-router';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { ConsoleHeader } from '@/components/layout/console-header';
import { ConsoleShellScope } from '@/components/layout/route-failure';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { usePreferencesStore } from '@/features/preferences/store/preferences-store';

export function ConsoleLayout() {
  const sidebarOpen = usePreferencesStore((state) => state.sidebarOpen);
  const setSidebarOpen = usePreferencesStore((state) => state.setSidebarOpen);

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <AppSidebar />
      <SidebarInset className="min-w-0 overflow-hidden bg-background/80">
        <ConsoleHeader />
        <div className="page-container">
          <ConsoleShellScope>
            <Outlet />
          </ConsoleShellScope>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
