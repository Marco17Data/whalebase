import { useEffect, useState } from 'react';
import {
  LayoutGrid, MessageSquare, BarChart3, ArrowRight,
  TrendingUp, RefreshCw, GitBranch, Users, ChevronRight,
} from 'lucide-react';
import type {
  DashboardCard, TemplateMeta, PresetQuestion, AnswerResponse, TemplateResult,
} from '../types';
import { api } from '../api';
import { useI18n } from '../i18n';
import { HeroOverview } from './HeroOverview';
import { SmartChart } from './SmartChart';

type View = 'home' | 'template' | 'presets' | 'pivot';

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
  const [autoCards, setAutoCards] = useState<DashboardCard[]>([]);
  const [templates, setTemplates] = useState<TemplateMeta[]>([]);
  const [templateResult, setTemplateResult] = useState<TemplateResult | null>(null);
  const [presets, setPresets] = useState<PresetQuestion[]>([]);
  const [loadingTemplate, setLoadingTemplate] = useState<string | null>(null);
  const [loadingPreset, setLoadingPreset] = useState<string | null>(null);

  // 切换语言或切换表时,刷新所有内容
  useEffect(() => {
    api.getDashboard(sessionId, lang, activeTable || undefined).then((r) => setAutoCards(r.cards)).catch(() => {});
    api.listTemplates(lang).then((r) => setTemplates(r.templates)).catch(() => {});
    api.getPresetQuestions(sessionId, lang, activeTable || undefined).then((r) => setPresets(r.questions)).catch(() => {});
    // 切换表时,关闭已打开的模板视图(因为它是上一张表的)
    setTemplateResult(null);
    setView('home');
  }, [sessionId, lang, activeTable]);

  // 仅 lang 变化时,重新拉取当前模板(table 变化的清理已在上面)
  useEffect(() => {
    if (templateResult) {
      api.runTemplate(sessionId, templateResult.template_id, lang, activeTable || undefined)
        .then((res) => setTemplateResult(res))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const runTemplate = async (tid: string) => {
    setLoadingTemplate(tid);
    try {
      const res = await api.runTemplate(sessionId, tid, lang, activeTable || undefined);
      setTemplateResult(res);
      setView('template');
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setLoadingTemplate(null);
    }
  };

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

  if (view === 'template' && templateResult) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-6 animate-fade-in">
        <button
          onClick={() => { setView('home'); setTemplateResult(null); }}
          className="btn-ghost mb-4"
        >
          <ChevronRight className="w-3 h-3 rotate-180" /> {t('dashboard.back')}
        </button>
        <h1 className="text-xl font-semibold text-slate-900 mb-4 tracking-tight">
          {templateResult.title}
        </h1>
        <DashboardGrid cards={templateResult.cards} currency={currency} />
        {templateResult.warnings.length > 0 && (
          <div className="card p-3 bg-amber-50 border-amber-200 mt-4 text-xs text-amber-900">
            {templateResult.warnings.join(' · ')}
          </div>
        )}
      </div>
    );
  }

  if (view === 'presets') {
    return (
      <div className="max-w-4xl mx-auto px-6 py-6 animate-fade-in">
        <button onClick={() => setView('home')} className="btn-ghost mb-4">
          <ChevronRight className="w-3 h-3 rotate-180" /> {t('dashboard.back')}
        </button>
        <h1 className="text-xl font-semibold text-slate-900 mb-1 tracking-tight">
          {t('dashboard.presets_title')}
        </h1>
        <p className="text-sm text-slate-500 mb-5">{t('dashboard.presets_desc')}</p>
        <PresetList presets={presets} onRun={runPreset} loadingId={loadingPreset} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-5 animate-fade-in space-y-4">
      {/* HERO: 4 KPIs + main pie + AI insights + trend */}
      <HeroOverview
        sessionId={sessionId}
        currency={currency}
        activeTable={activeTable}
      />

      {/* Explore deeper: collapsed templates / presets / pivot */}
      <div className="pt-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
          {t('dashboard.explore_deeper')}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <EntryCard
            icon={<LayoutGrid className="w-4 h-4" />}
            title={t('dashboard.templates_title')}
            desc={t('dashboard.templates_desc')}
            badge={templates.length.toString()}
            onClick={() => {
              const el = document.getElementById('templates-section');
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            accent
          />
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

        <section id="templates-section">
          <h2 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">
            {t('dashboard.templates_title')}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {templates.map((tpl) => (
              <TemplateButton
                key={tpl.id}
                template={tpl}
                loading={loadingTemplate === tpl.id}
                onClick={() => runTemplate(tpl.id)}
              />
            ))}
          </div>
        </section>

        {presets.length > 0 && (
          <section className="mt-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
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
  icon, title, desc, badge, onClick, accent = false,
}: {
  icon: React.ReactNode;
  title: string; desc: string;
  badge?: string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`card p-4 text-left hover:shadow-md transition-all
        ${accent ? 'border-brand-300 hover:border-brand-500' : 'hover:border-slate-300'}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className={`w-9 h-9 rounded-md flex items-center justify-center
          ${accent ? 'bg-brand-900 text-white' : 'bg-slate-100 text-slate-700'}`}>
          {icon}
        </div>
        {badge && (
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded
            ${accent ? 'bg-accent-50 text-accent-700' : 'bg-slate-100 text-slate-600'}`}>
            {badge}
          </span>
        )}
      </div>
      <h3 className="text-sm font-semibold text-slate-900 mb-0.5">{title}</h3>
      <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
    </button>
  );
}

function TemplateButton({
  template, loading, onClick,
}: {
  template: TemplateMeta;
  loading: boolean;
  onClick: () => void;
}) {
  const icons: Record<string, React.ReactNode> = {
    'trending-up': <TrendingUp className="w-4 h-4" />,
    'refresh-cw': <RefreshCw className="w-4 h-4" />,
    'git-branch': <GitBranch className="w-4 h-4" />,
    'users': <Users className="w-4 h-4" />,
  };
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="card p-3 text-left hover:border-brand-300 hover:bg-brand-50/30 transition-all
                 disabled:opacity-50 group"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-brand-700">{icons[template.icon] || <LayoutGrid className="w-4 h-4" />}</span>
        {loading && <span className="dot-loader"><span /><span /><span /></span>}
      </div>
      <div className="text-sm font-medium text-slate-900">{template.title}</div>
      <div className="flex items-center gap-1 mt-1.5 text-[10px] text-slate-400 group-hover:text-brand-600">
        <ArrowRight className="w-3 h-3" />
      </div>
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
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            {t(`preset.cat.${cat}`)}
          </div>
          <div className="space-y-1.5">
            {items.map((p) => (
              <button
                key={p.id}
                onClick={() => onRun(p.id)}
                disabled={loadingId === p.id}
                className="group w-full text-left px-4 py-2.5 rounded-md
                           bg-white border border-slate-200
                           hover:border-brand-500 hover:bg-brand-50/30 transition-all
                           flex items-center justify-between disabled:opacity-50"
              >
                <span className="text-sm text-slate-700 group-hover:text-brand-900">
                  {p.label}
                </span>
                {loadingId === p.id ? (
                  <span className="dot-loader"><span /><span /><span /></span>
                ) : (
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-brand-500 transition-colors" />
                )}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function DashboardGrid({ cards, currency }: { cards: DashboardCard[]; currency: string }) {
  const kpis = cards.filter((c) => c.chart_type === 'kpi');
  const charts = cards.filter((c) => c.chart_type !== 'kpi');
  return (
    <div className="space-y-3">
      {kpis.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {kpis.map((card, i) => (
            <DashboardCardItem key={i} card={card} currency={currency} compact />
          ))}
        </div>
      )}
      {charts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {charts.map((card, i) => (
            <DashboardCardItem key={i} card={card} currency={currency} />
          ))}
        </div>
      )}
    </div>
  );
}

function DashboardCardItem({
  card, currency, compact = false,
}: {
  card: DashboardCard;
  currency: string;
  compact?: boolean;
}) {
  return (
    <div className={`card-shadow p-4 ${compact ? '' : 'md:p-5'}`}>
      <div className="mb-2">
        <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
          {card.title}
        </h3>
        {!compact && card.subtitle && (
          <p className="text-[11px] text-slate-400 mt-0.5">{card.subtitle}</p>
        )}
      </div>
      <SmartChart result={card.result} chartType={card.chart_type} currency={currency} />
    </div>
  );
}
