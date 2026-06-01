import SidebarNav, { type DashboardView, type ShellNavItem } from './SidebarNav';
import TrayStatusBar from './TrayStatusBar';
import type { TrayStatusKind } from '@/state/trayStatus';

interface AppShellProps {
  activeView: DashboardView;
  onNavigate: (view: DashboardView) => void;
  navItems: ShellNavItem[];
  settingsLabel: string;
  statusKind?: TrayStatusKind;
  statusLabel: string;
  statusTitle: string;
  coreLabel: string;
  sourceCommandLabel: string;
  lastCapturedLabel: string;
  noRefreshLabel: string;
  statusCommand?: string;
  statusCapturedAt?: string;
  coreVersion?: string;
  onRefresh?: () => void;
  refreshLabel: string;
  isRefreshing?: boolean;
  children: React.ReactNode;
}

export default function AppShell({
  activeView,
  onNavigate,
  navItems,
  settingsLabel,
  statusKind,
  statusLabel,
  statusTitle,
  coreLabel,
  sourceCommandLabel,
  lastCapturedLabel,
  noRefreshLabel,
  statusCommand,
  statusCapturedAt,
  coreVersion,
  onRefresh,
  refreshLabel,
  isRefreshing,
  children,
}: AppShellProps) {
  return (
    <div className="flex h-screen w-screen bg-app" style={{ backgroundColor: '#0C0C0F' }}>
      <SidebarNav
        activeView={activeView}
        onNavigate={onNavigate}
        items={navItems}
        settingsLabel={settingsLabel}
      />
      <div className="flex flex-col flex-1 min-w-0">
        <main className="flex-1 overflow-hidden relative">
          {children}
        </main>
        <TrayStatusBar
          statusKind={statusKind}
          statusLabel={statusLabel}
          statusTitle={statusTitle}
          coreLabel={coreLabel}
          sourceCommandLabel={sourceCommandLabel}
          lastCapturedLabel={lastCapturedLabel}
          noRefreshLabel={noRefreshLabel}
          statusCommand={statusCommand}
          statusCapturedAt={statusCapturedAt}
          coreVersion={coreVersion}
          onRefresh={onRefresh}
          refreshLabel={refreshLabel}
          isRefreshing={isRefreshing}
        />
      </div>
    </div>
  );
}
