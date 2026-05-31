import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import type { TrayStatusKind } from '@/state/trayStatus';

interface TrayStatusBarProps {
  locale: 'zh' | 'en';
  onLocaleChange: (locale: 'zh' | 'en') => void;
  languageLabel: string;
  cnLabel: string;
  enLabel: string;
  statusKind?: TrayStatusKind;
  coreVersion?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export default function TrayStatusBar({
  locale,
  onLocaleChange,
  languageLabel,
  cnLabel,
  enLabel,
  statusKind,
  coreVersion,
  onRefresh,
  isRefreshing,
}: TrayStatusBarProps) {
  const [showDropdown, setShowDropdown] = useState(false);

  const statusDotColor = statusKind === 'tools_exposed' ? '#22C55E' :
    statusKind === 'core_missing' || statusKind === 'core_error' || statusKind === 'recent_failures' ? '#EF4444' :
    '#EAB308';

  const statusText = statusKind ? {
    core_missing: 'Core 缺失',
    core_error: 'Core 错误',
    recent_failures: '最近失败',
    mount_not_configured: '挂载未配置',
    tools_exposed: '工具已暴露',
    capsules_disabled: 'Capsule 未启用',
    no_capsules: '无 Capsule',
  }[statusKind] : '未检查';

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
          {statusText}
        </span>
        <span className="text-[11px]" style={{ color: '#5A5A6A' }}>
          {coreVersion ? `skillrun ${coreVersion}` : ''}
        </span>
      </button>

      {/* Right: language and refresh controls */}
      <div className="flex items-center gap-3">
        <div
          className="flex items-center rounded-md"
          role="group"
          aria-label={languageLabel}
          style={{
            height: 20,
            backgroundColor: '#0C0C0F',
            border: '1px solid #1E1E2A',
            overflow: 'hidden',
          }}
        >
          {([
            ['zh', cnLabel],
            ['en', enLabel],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => onLocaleChange(value)}
              className="px-2 text-[10px] font-medium transition-colors duration-150"
              style={{
                height: 18,
                color: locale === value ? '#E7E7EC' : '#5A5A6A',
                backgroundColor: locale === value ? '#20202A' : 'transparent',
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={onRefresh}
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
                系统状态
              </p>
            </div>
            <div className="py-1">
              {[
                { label: 'Core 状态', value: statusText, color: statusDotColor },
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
