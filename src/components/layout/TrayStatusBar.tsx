import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import type { TrayStatusKind } from '@/state/trayStatus';

interface TrayStatusBarProps {
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
}

export default function TrayStatusBar({
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
}: TrayStatusBarProps) {
  const [showDropdown, setShowDropdown] = useState(false);

  const statusDotColor = statusKind === 'tools_exposed' ? '#22C55E' :
    statusKind === 'core_missing' || statusKind === 'core_error' || statusKind === 'recent_failures' ? '#EF4444' :
    '#EAB308';

  useEffect(() => {
    const timer = setInterval(() => {
      // keep-alive tick
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      className="flex items-center justify-between px-3 relative"
      style={{
        height: 28,
        backgroundColor: '#141419',
        borderTop: '1px solid #1E1E2A',
      }}
    >
      {/* Left: Status */}
      <button
        type="button"
        className="flex items-center gap-2"
        onClick={() => setShowDropdown(!showDropdown)}
      >
        <span
          className="rounded-full animate-status-pulse"
          style={{
            width: 8,
            height: 8,
            backgroundColor: statusDotColor,
          }}
        />
        <span className="text-[11px] font-medium tracking-wide" style={{ color: '#8A8A9A' }}>
          {statusLabel}
        </span>
        <span className="text-[11px]" style={{ color: '#5A5A6A' }}>
          {coreVersion ? `skillrun ${coreVersion}` : ''}
        </span>
      </button>

      {/* Right: refresh control */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={onRefresh}
          aria-label={refreshLabel}
          className="flex items-center justify-center rounded transition-colors duration-150 hover:bg-[#1A1A22]"
          style={{ width: 20, height: 20 }}
        >
          <motion.div
            animate={isRefreshing ? { rotate: 360 } : { rotate: 0 }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
          >
            <RefreshCw size={12} style={{ color: '#5A5A6A' }} />
          </motion.div>
        </button>
      </div>

      {/* Status Dropdown */}
      {showDropdown && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setShowDropdown(false)}
          />
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-2 mb-1 z-40 rounded-lg overflow-hidden"
            style={{
              width: 240,
              backgroundColor: '#141419',
              border: '1px solid #2A2A38',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}
          >
            <div className="px-3 py-2" style={{ borderBottom: '1px solid #1E1E2A' }}>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#5A5A6A' }}>
                {statusTitle}
              </p>
            </div>
            <div className="py-1">
              {[
                { label: coreLabel, value: coreVersion ? `${statusLabel} · ${coreVersion}` : statusLabel, color: statusDotColor },
                { label: sourceCommandLabel, value: statusCommand ?? noRefreshLabel, color: '#5A5A6A' },
                { label: lastCapturedLabel, value: statusCapturedAt ?? noRefreshLabel, color: '#5A5A6A' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2.5 px-3 py-1.5">
                  <span
                    className="rounded-full flex-shrink-0"
                    style={{ width: 6, height: 6, backgroundColor: item.color }}
                  />
                  <span className="text-[12px] flex-1" style={{ color: '#8A8A9A' }}>{item.label}</span>
                  <span className="text-[11px] font-mono" style={{ color: '#5A5A6A' }}>{item.value}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}
