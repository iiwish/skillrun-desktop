import SidebarNav, { type DashboardView, type ShellNavItem } from './SidebarNav';
import TrayStatusBar from './TrayStatusBar';
import type { TrayStatusKind } from '@/state/trayStatus';

interface AppShellProps {
  activeView: DashboardView;
  onNavigate: (view: DashboardView) => void;
  navItems: ShellNavItem[];
  settingsLabel: string;
  locale: 'zh' | 'en';
  onLocaleChange: (locale: 'zh' | 'en') => void;
  languageLabel: string;
  cnLabel: string;
  enLabel: string;
  statusKind?: TrayStatusKind;
  coreVersion?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  children: React.ReactNode;
}

export default function AppShell({
  activeView,
  onNavigate,
  navItems,
  settingsLabel,
  locale,
  onLocaleChange,
  languageLabel,
  cnLabel,
  enLabel,
  statusKind,
  coreVersion,
  onRefresh,
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
          locale={locale}
          onLocaleChange={onLocaleChange}
          languageLabel={languageLabel}
          cnLabel={cnLabel}
          enLabel={enLabel}
          statusKind={statusKind}
          coreVersion={coreVersion}
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
        />
      </div>
    </div>
  );
}
