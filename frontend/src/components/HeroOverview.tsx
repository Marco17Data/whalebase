import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';
import { PieChartECharts, PIE_COLORS } from './PieChartECharts';
import { Sparkles, TrendingUp, TrendingDown } from 'lucide-react';
import { api } from '../api';
import { useI18n } from '../i18n';

interface KPI {
  label: string;
  value: number | string;
  format: 'number' | 'currency' | 'date';
  sub?: number;
  sparkline?: number[];
  change_pct?: number | null;
  period_status?: 'complete' | 'partial' | 'single' | null;
}

interface Slice {
  label: string;
  value: number;
  pct: number;
}

interface PieData {
  title: string;
  dimension: string;
  total: number;
  is_currency: boolean;
  slices: Slice[];
}

interface TrendPoint {
  month: string;
  value: number;
}

interface TrendData {
  title: string;
  is_currency: boolean;
  points: TrendPoint[];
}

interface Overview {
  kpis: KPI[];
  pie: PieData | null;
  trend: TrendData | null;
}

interface Props {
  sessionId: string;
  currency: string;
  activeTable: string | null;
}

const SLICE_COLORS = ['#1e3a8a', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4'];

function formatNum(v: number, isCurrency: boolean, currency: string): string {
  if (typeof v !== 'number' || !isFinite(v)) return '—';
  const symbol = currency === 'CNY' ? '¥' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' :
                 currency === 'JPY' ? '¥' : currency === 'KRW' ? '₩' : currency === 'INR' ? '₹' : '$';
  const abs = Math.abs(v);
  let formatted: string;
  if (abs >= 1e9) formatted = (v / 1e9).toFixed(2) + 'B';
  else if (abs >= 1e6) formatted = (v / 1e6).toFixed(2) + 'M';
  else if (abs >= 1e3) formatted = (v / 1e3).toFixed(1) + 'K';
  else formatted = v.toFixed(0);
  return isCurrency ? symbol + formatted : formatted;
}

export function HeroOverview({ sessionId, currency, activeTable }: Props) {
  const { t, lang } = useI18n();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiInsights, setAiInsights] = useState<Array<{ title: string; content: string }> | null>(null);
  const [aiLoading, setAiLoading] = useState(true);

  useEffect(() => {
    if (currency === 'none') return;
    setLoading(true);
    api.getOverview(sessionId, lang, activeTable || undefined)
      .then((r) => {
        setData(r);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [sessionId, lang, activeTable, currency]);

  // Fetch real AI insights (async, takes longer than overview)
  useEffect(() => {
    if (currency === 'none') return;
    setAiLoading(true);
    setAiInsights(null);
    api.getAutoInsights(sessionId, lang)
      .then((r) => {
        if (r.insights && r.insights.length > 0) {
          setAiInsights(r.insights.slice(0, 3));
        }
        setAiLoading(false);
      })
      .catch(() => {
        setAiInsights(null);
        setAiLoading(false);
      });
  }, [sessionId, lang, activeTable, currency]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
        {t('common.loading')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data.kpis.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {data.kpis.map((kpi, i) => (
            <KPICard key={i} kpi={kpi} currency={currency} />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        {data.pie && (
          <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 mb-3">
              {data.pie.title}
            </div>
            <div className="flex items-center gap-4">
              <PieChartECharts
                slices={data.pie.slices}
                total={data.pie.total}
                totalLabel="TOTAL"
                totalValueText={
                  // Use the grand total from KPIs (Total Revenue) if available, else pie sum
                  (() => {
                    const revKpi = data.kpis.find(k => k.format === 'currency' && typeof k.value === 'number');
                    if (revKpi && typeof revKpi.value === 'number') {
                      return formatNum(revKpi.value, true, currency);
                    }
                    return formatNum(data.pie.total, data.pie.is_currency, currency);
                  })()
                }
                width={280}
                height={280}
              />
              <div className="flex-1 space-y-1.5 text-sm">
                {data.pie.slices.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    <span className="text-slate-700 flex-1 truncate">{s.label}</span>
                    <span className="text-slate-500 text-xs font-medium">{s.pct.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>

            {data.pie.slices.length >= 2 && (
              <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-3 gap-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t('hero.top')}</div>
                  <div className="text-sm font-semibold text-slate-800 mt-1 truncate">{data.pie.slices[0].label}</div>
                  <div className="text-xs text-slate-500 tabular-nums">{data.pie.slices[0].pct.toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t('hero.lowest')}</div>
                  <div className="text-sm font-semibold text-slate-800 mt-1 truncate">{data.pie.slices[data.pie.slices.length - 1].label}</div>
                  <div className="text-xs text-slate-500 tabular-nums">{data.pie.slices[data.pie.slices.length - 1].pct.toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t('hero.concentration')}</div>
                  <div className="text-sm font-semibold mt-1" style={{
                    color: data.pie.slices[0].pct > 50 ? '#dc2626' : data.pie.slices[0].pct > 35 ? '#d97706' : '#059669'
                  }}>
                    {data.pie.slices[0].pct > 50 ? t('hero.high_risk') : data.pie.slices[0].pct > 35 ? t('hero.moderate') : t('hero.balanced')}
                  </div>
                  <div className="text-xs text-slate-500">{t('hero.top_3')}: {data.pie.slices.slice(0, 3).reduce((s, x) => s + x.pct, 0).toFixed(0)}%</div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="lg:col-span-2 bg-blue-900 text-white rounded-xl p-5 self-start" style={{ boxShadow: '0 0 24px rgba(30, 58, 138, 0.25), 0 8px 24px rgba(30, 58, 138, 0.15)' }}>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-amber-300" />
            <div className="text-xs font-semibold uppercase tracking-wide">{t('hero.ai_insights')}</div>
            {aiLoading && (
              <div className="ml-auto w-3 h-3 border-2 border-amber-300/30 border-t-amber-300 rounded-full animate-spin" />
            )}
          </div>
          <div className="space-y-2.5 text-sm text-blue-100">
            {aiLoading && !aiInsights ? (
              [0, 1, 2].map((i) => (
                <div key={i} className="flex items-start gap-2 animate-pulse">
                  <span className="text-amber-300/40 mt-0.5">✦</span>
                  <div className="flex-1 space-y-1">
                    <div className="h-3 bg-blue-700/40 rounded w-5/6"></div>
                    <div className="h-3 bg-blue-700/40 rounded w-2/3"></div>
                  </div>
                </div>
              ))
            ) : aiInsights && aiInsights.length > 0 ? (
              aiInsights.map((insight, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-amber-300 mt-0.5">✦</span>
                  <div>
                    {insight.title && (
                      <div className="font-semibold text-white">{insight.title}</div>
                    )}
                    <div className="text-blue-100">{insight.content}</div>
                  </div>
                </div>
              ))
            ) : (
              <>
                <div className="flex items-start gap-2">
                  <span className="text-amber-300 mt-0.5">✦</span>
                  <span>{t('hero.insight_placeholder_1')}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-amber-300 mt-0.5">✦</span>
                  <span>{t('hero.insight_placeholder_2')}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-amber-300 mt-0.5">✦</span>
                  <span>{t('hero.insight_placeholder_3')}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {data.trend && data.trend.points.length > 1 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 mb-3">
            {data.trend.title}
          </div>
          <div style={{ width: '100%', height: 180 }}>
            <ResponsiveContainer>
              <LineChart data={data.trend.points} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={(v) => formatNum(v, data.trend!.is_currency, currency)}
                />
                <Tooltip
                  formatter={(v: number) => formatNum(v, data.trend!.is_currency, currency)}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Line type="monotone" dataKey="value" stroke="#1e3a8a" strokeWidth={2} dot={{ r: 3, fill: '#1e3a8a' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

function KPICard({ kpi, currency }: { kpi: KPI; currency: string }) {
  const { t } = useI18n();

  let displayValue: string;
  if (kpi.format === 'currency' || kpi.format === 'number') {
    displayValue = typeof kpi.value === 'number'
      ? formatNum(kpi.value, kpi.format === 'currency', currency)
      : String(kpi.value);
  } else {
    displayValue = String(kpi.value);
  }

  const hasChange = kpi.change_pct !== null && kpi.change_pct !== undefined;
  const isPositive = (kpi.change_pct ?? 0) > 0;
  const sparkline = kpi.sparkline ?? [];
  const hasSparkline = sparkline.length >= 2;

  let subInfo: string;
  if (kpi.format === 'date') {
    subInfo = kpi.sub !== undefined ? formatNum(kpi.sub, true, currency) : '';
  } else if (kpi.period_status === 'partial') {
    subInfo = t('kpi.partial_month');
  } else if (kpi.period_status === 'single') {
    subInfo = t('kpi.single_period');
  } else if (kpi.period_status === 'complete' && hasSparkline) {
    subInfo = t('kpi.last_12_months');
  } else {
    subInfo = t('kpi.all_data');
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 relative overflow-hidden">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          {kpi.label}
        </div>
        {hasChange && (
          <div className={`text-[11px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
            isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
          }`}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {isPositive ? '+' : ''}{kpi.change_pct!.toFixed(1)}%
          </div>
        )}
      </div>

      <div className="text-2xl font-bold text-slate-800 mt-1.5 leading-tight">
        {displayValue}
      </div>

      {hasSparkline && (
        <div className="mt-2 -mx-1 h-12">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkline.map((v, i) => ({ i, v }))} margin={{ top: 4, right: 2, left: 2, bottom: 2 }}>
              <YAxis hide domain={['dataMin - dataMin*0.1', 'dataMax + dataMax*0.05']} />
              <Line
                type="monotone"
                dataKey="v"
                stroke={isPositive ? '#10b981' : '#ef4444'}
                strokeWidth={2}
                dot={(props: { cx?: number; cy?: number; index?: number }) => {
                  const isLast = props.index === sparkline.length - 1;
                  if (!isLast) return <g />;
                  return (
                    <circle
                      cx={props.cx}
                      cy={props.cy}
                      r={3}
                      fill={isPositive ? '#10b981' : '#ef4444'}
                      stroke="white"
                      strokeWidth={1.5}
                    />
                  );
                }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className={`text-[10px] mt-1.5 flex items-center gap-1 ${
        kpi.period_status === 'partial' ? 'text-amber-600' : 'text-slate-400'
      }`}>
        {kpi.period_status === 'partial' && <span>⚠</span>}
        {subInfo}
      </div>
    </div>
  );
}