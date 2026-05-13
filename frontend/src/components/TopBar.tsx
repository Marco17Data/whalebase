import { useState, useEffect, useRef } from 'react';
import {
  Sparkles, Globe, Settings, Download, History, Code2,
  ChevronDown, BarChart3, LayoutGrid, MessageSquare, FileDown,
  Shield, Zap,
} from 'lucide-react';
import { Logo } from './Logo';
import { useI18n, LANGUAGES, Lang } from '../i18n';

interface Props {
  queryCount: number;
  tableCount: number;
  totalRows: number;
  currency: string;
  onToggleSQL: () => void;
  onToggleHistory: () => void;
  onExport: () => void;
  onSettings: () => void;
  onAskAI: () => void;
  onChangeCurrency: () => void;
  sqlOpen: boolean;
  historyOpen: boolean;
}

export function TopBar({
  queryCount,
  tableCount,
  totalRows,
  currency,
  onToggleSQL,
  onToggleHistory,
  onExport,
  onSettings,
  onAskAI,
  onChangeCurrency,
  sqlOpen,
  historyOpen,
}: Props) {
  const { t } = useI18n();

  return (
    <header className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-5 shrink-0 z-30 relative">
      {/* 左：Logo + 菜单 */}
      <div className="flex items-center gap-1">
        <div className="flex items-center gap-2.5 mr-4">
          <Logo size={32} />
          <div className="flex flex-col leading-none">
            <span className="text-base font-semibold text-slate-900 tracking-tight">
              Whalebase
              <span className="ml-1 text-[9px] text-slate-400 font-mono font-normal">v4.4</span>
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wider">
              {t('app.tagline')}
            </span>
          </div>
        </div>

        <FeaturesDropdown />
        <AboutDropdown />
      </div>

      {/* 中：指标卡片（数据上传后显示） */}
      {tableCount > 0 && (
        <div className="hidden lg:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
          <MetricChip label={t('data.title')} value={tableCount} />
          <MetricChip label={t('query.rows', { n: '' }).replace('{n}', '').trim()} value={totalRows.toLocaleString()} />
          {queryCount > 0 && (
            <MetricChip label={t('nav.history')} value={queryCount} />
          )}
        </div>
      )}

      {/* 右：工具栏 */}
      <div className="flex items-center gap-1">
        {/* AI button - 退到右上角 */}
        <button
          onClick={onAskAI}
          disabled={tableCount === 0}
          className="btn-secondary !py-1.5 !text-xs"
          title={t('nav.ai')}
        >
          <Sparkles className="w-3.5 h-3.5 text-accent-500" />
          <span className="hidden sm:inline">{t('nav.ai')}</span>
        </button>

        <div className="w-px h-5 bg-slate-200 mx-1" />

        <button
          onClick={onToggleSQL}
          className={`btn-ghost ${sqlOpen ? '!bg-brand-50 !text-brand-900' : ''}`}
          title={t('nav.sql')}
        >
          <Code2 className="w-4 h-4" />
        </button>
        <button
          onClick={onToggleHistory}
          disabled={queryCount === 0}
          className={`btn-ghost ${historyOpen ? '!bg-brand-50 !text-brand-900' : ''}`}
          title={t('nav.history')}
        >
          <History className="w-4 h-4" />
          {queryCount > 0 && (
            <span className="chip-brand !px-1 !py-0 !text-[10px]">{queryCount}</span>
          )}
        </button>
        <button
          onClick={onExport}
          disabled={queryCount === 0}
          className="btn-ghost"
          title={t('nav.export')}
        >
          <Download className="w-4 h-4" />
        </button>

        {/* 货币徽章 - 只在有数据时显示 */}
        {tableCount > 0 && (
          <button
            onClick={onChangeCurrency}
            className="btn-ghost !px-2 !text-[11px] font-mono font-semibold"
            title={t('currency.title')}
          >
            {currency === 'none' ? '—' : currency}
          </button>
        )}

        <LanguageDropdown />
        <button onClick={onSettings} className="btn-ghost" title={t('nav.settings')}>
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}

// =================
// Features 下拉菜单
// =================
function FeaturesDropdown() {
  const { t } = useI18n();
  return (
    <Dropdown label={t('nav.features')} hoverOpen>
      <div className="grid grid-cols-1 gap-1 p-2 w-72">
        <DropdownItem
          icon={<LayoutGrid className="w-4 h-4 text-brand-700" />}
          title={t('features.dashboard.title')}
          desc={t('features.dashboard.desc')}
        />
        <DropdownItem
          icon={<MessageSquare className="w-4 h-4 text-brand-700" />}
          title={t('features.presets.title')}
          desc={t('features.presets.desc')}
        />
        <DropdownItem
          icon={<BarChart3 className="w-4 h-4 text-brand-700" />}
          title={t('features.pivot.title')}
          desc={t('features.pivot.desc')}
        />
        <DropdownItem
          icon={<Sparkles className="w-4 h-4 text-accent-500" />}
          title={t('features.ai.title')}
          desc={t('features.ai.desc')}
        />
        <DropdownItem
          icon={<FileDown className="w-4 h-4 text-brand-700" />}
          title={t('features.export.title')}
          desc={t('features.export.desc')}
        />
        <DropdownItem
          icon={<Shield className="w-4 h-4 text-success" />}
          title={t('features.privacy.title')}
          desc={t('features.privacy.desc')}
        />
      </div>
    </Dropdown>
  );
}

// =================
// About 下拉
// =================
function AboutDropdown() {
  const { t } = useI18n();
  return (
    <Dropdown label={t('nav.about')} hoverOpen>
      <div className="p-4 w-80">
        <h3 className="text-sm font-semibold text-slate-900 mb-1.5">
          {t('about.title')}
        </h3>
        <p className="text-xs text-slate-600 leading-relaxed mb-3">
          {t('about.desc')}
        </p>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-100">
          <Zap className="w-3 h-3" />
          {t('about.tech')}
        </div>
      </div>
    </Dropdown>
  );
}

// =================
// Language 下拉
// =================
function LanguageDropdown() {
  const { lang, setLang, t } = useI18n();
  const current = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];

  return (
    <Dropdown
      trigger={
        <button className="btn-ghost" title={t('nav.language')}>
          <Globe className="w-4 h-4" />
          <span className="hidden md:inline text-xs">{current.flag} {current.code.toUpperCase()}</span>
        </button>
      }
    >
      <div className="p-1 w-44 max-h-80 overflow-y-auto">
        {LANGUAGES.map((l) => (
          <button
            key={l.code}
            onClick={() => setLang(l.code as Lang)}
            className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2.5
              ${lang === l.code ? 'bg-brand-50 text-brand-900' : 'hover:bg-slate-50 text-slate-700'}`}
          >
            <span className="text-base">{l.flag}</span>
            <span className="flex-1">{l.name}</span>
            {lang === l.code && <span className="text-brand-600 text-xs">✓</span>}
          </button>
        ))}
      </div>
    </Dropdown>
  );
}

// =================
// 通用下拉组件
// hoverOpen=true 时鼠标悬停就展开(用于 Features/About)
// 否则点击展开(用于 Language)
// =================
function Dropdown({
  label,
  trigger,
  children,
  hoverOpen = false,
}: {
  label?: string;
  trigger?: React.ReactNode;
  children: React.ReactNode;
  hoverOpen?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 点击外部关闭(仅 click 模式)
  useEffect(() => {
    if (!open || hoverOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, hoverOpen]);

  // hover 延迟关闭(避免按钮/菜单间移动时闪烁)
  const handleEnter = () => {
    if (!hoverOpen) return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const handleLeave = () => {
    if (!hoverOpen) return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {trigger ? (
        <div onClick={() => !hoverOpen && setOpen(!open)} className="cursor-pointer">
          {trigger}
        </div>
      ) : (
        <button
          onClick={() => !hoverOpen && setOpen(!open)}
          className={`btn-ghost ${open ? '!bg-slate-100 !text-slate-900' : ''}`}
        >
          {label}
          <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      )}
      {open && (
        <div className="absolute top-full mt-1.5 left-0 bg-white border border-slate-200 rounded-lg shadow-lg z-40 animate-fade-in">
          {children}
        </div>
      )}
    </div>
  );
}

function DropdownItem({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-2.5 px-3 py-2 rounded-md hover:bg-slate-50 cursor-default">
      <div className="w-7 h-7 rounded-md bg-slate-50 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-slate-900">{title}</div>
        <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

function MetricChip({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px]">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900 tabular-nums">{value}</span>
    </div>
  );
}
