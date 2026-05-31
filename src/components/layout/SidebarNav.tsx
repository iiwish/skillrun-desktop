import { motion } from 'framer-motion';
import {
  Settings,
  type LucideIcon,
} from 'lucide-react';

export type DashboardView = "capsules" | "teamLibrary" | "clients" | "tools" | "runs" | "settings";

export type ShellNavItem = {
  icon: LucideIcon;
  label: string;
  navLabel: string;
  id: DashboardView;
};

interface SidebarNavProps {
  activeView: DashboardView;
  onNavigate: (view: DashboardView) => void;
  items: ShellNavItem[];
  settingsLabel: string;
}

export default function SidebarNav({ activeView, onNavigate, items, settingsLabel }: SidebarNavProps) {
  return (
    <nav
      className="flex flex-col items-center py-2 relative z-20"
      style={{
        width: 56,
        backgroundColor: '#141419',
        borderRight: '1px solid #1E1E2A',
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center justify-center mb-4 cursor-pointer"
        style={{ width: 40, height: 40 }}
        onClick={() => onNavigate('capsules')}
      >
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <rect width="28" height="28" rx="6" fill="#3B82F6" opacity="0.15" />
          <path d="M8 20V8l6 4.5L8 20z" fill="#3B82F6" />
          <path d="M14 12.5L20 8v12l-6-4.5z" fill="#3B82F6" opacity="0.6" />
        </svg>
      </div>

      {/* Nav Items */}
      <div className="flex flex-col items-center gap-1 flex-1">
        {items.filter(item => item.id !== 'settings').map(item => {
          const isActive = activeView === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className="relative flex items-center justify-center rounded-md transition-colors duration-150"
              style={{
                width: 40,
                height: 40,
                color: isActive ? '#3B82F6' : '#5A5A6A',
              }}
              onMouseEnter={e => {
                if (!isActive) e.currentTarget.style.color = '#8A8A9A';
                e.currentTarget.style.backgroundColor = isActive ? 'transparent' : '#1A1A22';
              }}
              onMouseLeave={e => {
                if (!isActive) e.currentTarget.style.color = '#5A5A6A';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              title={item.navLabel}
              aria-label={item.label}
            >
              {isActive && (
                <motion.div
                  layoutId="active-nav"
                  className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full"
                  style={{
                    width: 3,
                    height: 20,
                    backgroundColor: '#3B82F6',
                  }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <Icon size={20} strokeWidth={isActive ? 2 : 1.5} />
              <span className="sr-only">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Settings */}
      <button
        onClick={() => onNavigate('settings')}
        className="relative flex items-center justify-center rounded-md transition-colors duration-150"
        style={{
          width: 40,
          height: 40,
          color: activeView === 'settings' ? '#3B82F6' : '#5A5A6A',
        }}
        onMouseEnter={e => {
          if (activeView !== 'settings') e.currentTarget.style.color = '#8A8A9A';
          e.currentTarget.style.backgroundColor = activeView === 'settings' ? 'transparent' : '#1A1A22';
        }}
        onMouseLeave={e => {
          if (activeView !== 'settings') e.currentTarget.style.color = '#5A5A6A';
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
        title={settingsLabel}
        aria-label={settingsLabel}
      >
        {activeView === 'settings' && (
          <motion.div
            layoutId="active-nav"
            className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full"
            style={{ width: 3, height: 20, backgroundColor: '#3B82F6' }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          />
        )}
        <Settings size={20} strokeWidth={activeView === 'settings' ? 2 : 1.5} />
        <span className="sr-only">{settingsLabel}</span>
      </button>
    </nav>
  );
}
