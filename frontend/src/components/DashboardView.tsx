import { useEffect, useState } from 'react';
import {
  MessageSquare, BarChart3, ArrowRight, ChevronRight,
} from 'lucide-react';
import type { PresetQuestion, AnswerResponse } from '../types';
import { api } from '../api';
import { useI18n } from '../i18n';
import { HeroOverview } from './HeroOverview';

type View = 'home' | 'presets';

interface Props {
  sessionId: string;
  currency: string;
  activeTable: string | null;
  onQueryGenerated: (answer: AnswerResponse) => void;
  onOpenPivot: () => void;
}

export function DashboardView({ sessionId, currency, activeTable, onQueryGenerated, onOpenPivot }: Props) {
  const { t, lang } = useI18n();
  const [view, setView] = useState<View>('home');
  const [presets, setPresets] = useState<PresetQuestion[]>([]);
  const [loadingPreset, setLoadingPreset] = useState<string | null>(null);

  useEffect(() => {
    api.getPresetQuestions(sessionId, lang, activeTable || undefined).then((r) => setPresets(r.questions)).catch(() => {});
    setView('home');
  }, [sessionId, lang, activeTable]);

  const runPreset = async (pid: string) => {
    setLoadingPreset(pid);
    try {
      const ans = await api.runPreset(sessionId, pid, lang, activeTable || undefined);
      onQueryGenerated(ans);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setLoadingPreset(null);
    }
  };

  if (view === 'presets') {
    return (
      <div className="max-w-4xl mx-auto px-6 py-6 animate-fade-in">
        <button onClick={() => setView('home')} className="btn-ghost mb-4">
          <ChevronRight className="w-3 h-3 rotate-180" /> {t('dashboard.back')}
        </button>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-1 tracking-tight">
          {t('dashboard.presets_title')}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">{t('dashboard.presets_desc')}</p>
        <PresetList presets={presets} onRun={runPreset} loadingId={loadingPreset} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-5 animate-fade-in space-y-4">
      <HeroOverview
        sessionId={sessionId}
        currency={currency}
        activeTable={activeTable}
      />

      <div className="pt-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3">
          {t('dashboard.explore_deeper')}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <EntryCard
            icon={<MessageSquare className="w-4 h-4" />}
            title={t('dashboard.presets_title')}
            desc={t('dashboard.presets_desc')}
            badge={presets.length.toString()}
            onClick={() => setView('presets')}
          />
          <EntryCard
            icon={<BarChart3 className="w-4 h-4" />}
            title={t('dashboard.pivot_title')}
            desc={t('dashboard.pivot_desc')}
            onClick={onOpenPivot}
          />
        </div>

        {presets.length > 0 && (
          <section className="mt-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                {t('dashboard.presets_title')}
              </h2>
              {presets.length > 6 && (
                <button onClick={() => setView('presets')} className="btn-ghost text-xs">
                  {t('dashboard.open')} <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
            <PresetList presets={presets.slice(0, 6)} onRun={runPreset} loadingId={loadingPreset} />
          </section>
        )}
      </div>
    </div>
  );
}

function EntryCard({
  icon, title, desc, badge, onClick,
}: {
  icon: React.ReactNode;
  title: string; desc: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="card p-4 text-left hover:shadow-md transition-all hover:border-slate-300 dark:hover:border-slate-600"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="w-9 h-9 rounded-md flex items-center justify-center bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
          {icon}
        </div>
        {badge && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
            {badge}
          </span>
        )}
      </div>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-0.5">{title}</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{desc}</p>
    </button>
  );
}

function PresetList({
  presets, onRun, loadingId,
}: {
  presets: PresetQuestion[];
  onRun: (id: string) => void;
  loadingId: string | null;
}) {
  const { t } = useI18n();
  const grouped: Record<string, PresetQuestion[]> = {};
  presets.forEach((p) => {
    if (!grouped[p.category]) grouped[p.category] = [];
    grouped[p.category].push(p);
  });

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat}>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
            {t(`preset.cat.${cat}`)}
          </div>
          <div className="space-y-1.5">
            {items.map((p) => (
              <button
                key={p.id}
                onClick={() => onRun(p.id)}
                disabled={loadingId === p.id}
                className="group w-full text-left px-4 py-2.5 rounded-md
                           bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700
                           hover:border-brand-500 dark:hover:border-brand-500 hover:bg-brand-50/30 dark:hover:bg-brand-900/20 transition-all
                           flex items-center justify-between disabled:opacity-50"
              >
                <span className="text-sm text-slate-700 dark:text-slate-200 group-hover:text-brand-900 dark:group-hover:text-brand-200">
                  {p.label}
                </span>
                {loadingId === p.id ? (
                  <span className="dot-loader"><span /><span /><span /></span>
                ) : (
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-brand-500 transition-colors" />
                )}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
