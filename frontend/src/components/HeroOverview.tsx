import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';
import { PieChartECharts, PIE_COLORS } from './PieChartECharts';
import { Sparkles, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { api } from '../api';
import { useI18n } from '../i18n';
import { useTheme } from '../ThemeContext';

// 前 6 个 dataset 的固定调色 (i 个 dataset -> 第 i 种颜色)
const COMPARE_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#a855f7', '#06b6d4'];
import DataQualityBar from './DataQualityBar';
import CompareBanner from './CompareBanner';
import CompareModeIndicator from './CompareModeIndicator';

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
  high_concentration?: boolean;
  top_pct?: number;
  top3_pct?: number;
  top_label?: string;
}

interface TrendPoint {
  month: string;
  value: number;
  is_anomaly?: boolean;
  anomaly_type?: 'spike' | 'drop' | null;
  deviation_pct?: number;
  mean_value?: number;
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
  comparison?: null | {
    datasets: string[];
    kpi_by_dataset: {
      rows?: Record<string, number>;
      revenue?: Record<string, number>;
    };
    trend_by_dataset: Record<string, Array<{ month: string; value: number }>>;
    is_currency: boolean;
  };
}

interface Props {
  sessionId: string;
  currency: string;
  activeTable: string | null;
  tablesCount?: number;
}

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

export function HeroOverview({ sessionId, currency, activeTable, tablesCount }: Props) {
  const { t, lang } = useI18n();
  const { theme } = useTheme();
  const [data, setData] = useState<Overview | null>(null);
  const [dq, setDq] = useState<any>(null);
  const [compareGroups, setCompareGroups] = useState<Array<{ tables: string[]; match_pct: number }>>([]);
  const [compareStatus, setCompareStatus] = useState<{ active: boolean; source_tables?: string[] }>({ active: false });
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [aiInsights, setAiInsights] = useState<Array<{ title: string; content: string }> | null>(null);
  const [aiLoading, setAiLoading] = useState(true);

  // Theme-aware colors for charts
  const isDark = theme === 'dark';
  const gridColor = isDark ? '#334155' : '#e2e8f0';
  const axisColor = isDark ? '#94a3b8' : '#64748b';
  const lineColor = isDark ? '#60a5fa' : '#1e3a8a';

  useEffect(() => {
    if (currency === 'none') return;
    setLoading(true);
    refreshAll();
  }, [sessionId, lang, activeTable, currency, tablesCount]);

  const refreshAll = () => {
    setBannerDismissed(false);
    api.getOverview(sessionId, lang, activeTable || undefined)
      .then((r) => {
        setData(r);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    api.getDataQuality(sessionId, lang, activeTable || undefined)
      .then(setDq)
      .catch(() => setDq(null));
    api.detectComparable(sessionId)
      .then((r) => setCompareGroups(r.groups))
      .catch(() => setCompareGroups([]));
    api.getCompareStatus(sessionId)
      .then((r) => setCompareStatus(r))
      .catch(() => setCompareStatus({ active: false }));
  };

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
  }, [sessionId, lang, activeTable, currency, tablesCount]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400 dark:text-slate-400 text-sm">
        {t('common.loading')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {compareStatus.active && compareStatus.source_tables && (
        <CompareModeIndicator
          sourceTables={compareStatus.source_tables}
          onExit={async () => {
            // 立即同步前端 state, 不等后端轮询
            setCompareStatus({ active: false });
            await api.disableCompare(sessionId);
            refreshAll();
          }}
        />
      )}
      {!compareStatus.active && !bannerDismissed && compareGroups.length > 0 && (
        <CompareBanner
          tables={compareGroups[0].tables}
          onCompare={async () => {
            const result = await api.enableCompare(sessionId, compareGroups[0].tables);
            if (result.ok) {
              // 立即同步前端 state
              setCompareStatus({ active: true, source_tables: result.source_tables });
            }
            setBannerDismissed(true);
            refreshAll();
          }}
          onDismiss={() => setBannerDismissed(true)}
        />
      )}
      {data.kpis.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {data.kpis.map((kpi, i) => (
            <KPICardWithCompare
              key={i}
              kpi={kpi}
              currency={currency}
              comparison={data.comparison || null}
              kpiIndex={i}
            />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        {data.pie && (
          <div className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-200">
                {data.pie.title}
              </div>
              {data.pie.high_concentration && (
                <div className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 px-2 py-0.5 rounded flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {t('anomaly.high_concentration')}
                </div>
              )}
            </div>
            <div className="flex items-center gap-4">
              <PieChartECharts
                slices={data.pie.slices}
                total={data.pie.total}
                totalLabel={t('hero.pie_total')}
                totalValueText={
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
                    <span className="text-slate-700 dark:text-slate-200 flex-1 truncate">{s.label}</span>
                    <span className="text-slate-500 dark:text-slate-300 text-xs font-medium">{s.pct.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>

            {data.pie.slices.length >= 2 && (
              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-700 grid grid-cols-3 gap-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-400">{t('hero.top')}</div>
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1 truncate">{data.pie.slices[0].label}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-300 tabular-nums">{data.pie.slices[0].pct.toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-400">{t('hero.lowest')}</div>
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1 truncate">{data.pie.slices[data.pie.slices.length - 1].label}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-300 tabular-nums">{data.pie.slices[data.pie.slices.length - 1].pct.toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-400">{t('hero.concentration')}</div>
                  <div className="text-sm font-semibold mt-1" style={{
                    color: data.pie.slices[0].pct > 50 ? '#ef4444' : data.pie.slices[0].pct > 35 ? '#f59e0b' : '#10b981'
                  }}>
                    {data.pie.slices[0].pct > 50 ? t('hero.high_risk') : data.pie.slices[0].pct > 35 ? t('hero.moderate') : t('hero.balanced')}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-300">{t('hero.top_3')}: {data.pie.slices.slice(0, 3).reduce((s, x) => s + x.pct, 0).toFixed(0)}%</div>
                </div>
              </div>
            )}
            {data.pie.high_concentration && (
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-start gap-2 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500 mt-0.5 flex-shrink-0" />
                <div className="text-slate-700 dark:text-slate-200">
                  <span className="font-semibold">{data.pie.top_label}</span>
                  <span className="text-slate-500 dark:text-slate-300"> {t('anomaly.accounts_for')} </span>
                  <span className="font-semibold text-rose-600 dark:text-rose-400 tabular-nums">{data.pie.top_pct?.toFixed(1)}%</span>
                  <span className="text-slate-500 dark:text-slate-300"> {t('anomaly.of_revenue')}. </span>
                  <span className="text-slate-400 dark:text-slate-400">{t('anomaly.diversification_hint')}</span>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="lg:col-span-2 bg-blue-900 dark:bg-blue-950 text-white rounded-xl p-5 self-start" style={{ boxShadow: '0 0 24px rgba(30, 58, 138, 0.25), 0 8px 24px rgba(30, 58, 138, 0.15)' }}>
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

      {data.comparison && data.comparison.trend_by_dataset && Object.keys(data.comparison.trend_by_dataset).length > 0 ? (
        <CompareTrendChart trend={data.comparison.trend_by_dataset} datasets={data.comparison.datasets} isCurrency={data.comparison.is_currency} currency={currency} />
      ) : data.trend && data.trend.points.length > 1 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-200">
              {data.trend.title}
            </div>
            {(() => {
              const anomalies = data.trend!.points.filter(p => p.is_anomaly);
              if (anomalies.length === 0) return null;
              return (
                <div className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 px-2 py-0.5 rounded flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {anomalies.length} {anomalies.length === 1 ? t('anomaly.singular') : t('anomaly.plural')}
                </div>
              );
            })()}
          </div>
          <div style={{ width: '100%', height: 180 }}>
            <ResponsiveContainer>
              <LineChart data={data.trend.points} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: axisColor }} tickFormatter={(v: string) => (typeof v === "string" ? v.slice(0, 7) : v)} />
                <YAxis
                  tick={{ fontSize: 11, fill: axisColor }}
                  tickFormatter={(v) => formatNum(v, data.trend!.is_currency, currency)}
                />
                <Tooltip
                  formatter={(v: number) => [formatNum(v, data.trend!.is_currency, currency), t('trend.value_label')]}
                  labelFormatter={(label: string) => {
                    if (typeof label === 'string' && label.length >= 7) {
                      return label.slice(0, 7);
                    }
                    return label;
                  }}
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    backgroundColor: isDark ? '#1e293b' : '#ffffff',
                    border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
                    color: isDark ? '#e2e8f0' : '#1e293b',
                  }}
                  labelStyle={{ color: isDark ? '#cbd5e1' : '#475569' }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={lineColor}
                  strokeWidth={2}
                  dot={(props: any) => {
                    const point = data.trend!.points[props.index];
                    const isAnomaly = point?.is_anomaly;
                    return (
                      <circle
                        cx={props.cx}
                        cy={props.cy}
                        r={isAnomaly ? 5 : 3}
                        fill={isAnomaly ? '#ef4444' : lineColor}
                        stroke={isAnomaly ? (isDark ? '#0f172a' : '#fff') : 'none'}
                        strokeWidth={isAnomaly ? 2 : 0}
                      />
                    );
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {(() => {
            const anomalies = data.trend!.points.filter(p => p.is_anomaly);
            if (anomalies.length === 0) return null;
            return (
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 space-y-1.5">
                {anomalies.map((a, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-500 mt-0.5 flex-shrink-0" />
                    <div className="text-slate-700 dark:text-slate-200">
                      <span className="font-semibold">{a.month}</span>
                      <span className="text-slate-500 dark:text-slate-300">: </span>
                      <span className="font-semibold tabular-nums">
                        {formatNum(a.value, data.trend!.is_currency, currency)}
                      </span>
                      <span className={`font-medium ml-2 ${a.anomaly_type === 'spike' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {(a.deviation_pct ?? 0) > 0 ? '+' : ''}{(a.deviation_pct ?? 0).toFixed(0)}% {a.anomaly_type === 'spike' ? t('anomaly.vs_avg_above') : t('anomaly.vs_avg_below')}
                      </span>
                      <span className="text-slate-400 dark:text-slate-400 ml-1">
                        ({t('anomaly.avg_is')} {formatNum(a.mean_value ?? 0, data.trend!.is_currency, currency)})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      <DataQualityBar data={dq} sessionId={sessionId} tableName={activeTable || undefined} onAfterCleanup={refreshAll} />
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
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4 relative overflow-hidden">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-300 uppercase tracking-wider">
          {kpi.label}
        </div>
        {hasChange && (
          <div className={`text-[11px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
            isPositive
              ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300'
          }`}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {isPositive ? '+' : ''}{kpi.change_pct!.toFixed(1)}%
          </div>
        )}
      </div>

      <div className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1.5 leading-tight">
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
        kpi.period_status === 'partial' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-400'
      }`}>
        {kpi.period_status === 'partial' && <span>⚠</span>}
        {subInfo}
      </div>
    </div>
  );
}


function KPICardWithCompare({
  kpi, currency, comparison, kpiIndex,
}: {
  kpi: KPI;
  currency: string;
  comparison: any;
  kpiIndex: number;
}) {
  const { t } = useI18n();
  if (!comparison || !comparison.datasets || comparison.datasets.length === 0) {
    return <KPICard kpi={kpi} currency={currency} />;
  }
  // 决定这个 KPI 用哪个 metric 显示 delta
  // kpiIndex=0 -> rows, kpiIndex=1 -> revenue (按 generate_compare_overview 的顺序)
  const metric = kpiIndex === 0 ? 'rows' : 'revenue';
  const byDataset = comparison.kpi_by_dataset?.[metric];
  if (!byDataset || comparison.datasets.length < 2) {
    return <KPICard kpi={kpi} currency={currency} />;
  }
  const datasets = comparison.datasets;
  const values = datasets.map((d: string) => byDataset[d] || 0);
  const isCurrency = kpi.format === 'currency';

  if (datasets.length === 2) {
    // 2 个 dataset: 显示 delta
    const [valA, valB] = values;
    const pct = valA > 0 ? ((valB - valA) / valA) * 100 : null;
    const pctStr = pct === null ? '' : (pct >= 0 ? `+${pct.toFixed(1)}%` : `${pct.toFixed(1)}%`);
    const positive = pct !== null && pct >= 0;
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-300 uppercase tracking-wider">
          {kpi.label}
        </div>
        <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
          {formatNum(valB, isCurrency, currency)}
        </div>
        {pct !== null && (
          <div className="mt-2 flex items-center gap-1.5">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold tabular-nums ${positive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'}`}>
              {pctStr}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {t('compare.vs')} <span className="font-mono">{datasets[0]}</span>
            </span>
          </div>
        )}
        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-0.5 text-xs">
          <div className="flex justify-between text-slate-500 dark:text-slate-400">
            <span className="font-mono truncate max-w-[60%]">{datasets[0]}</span>
            <span className="tabular-nums">{formatNum(valA, isCurrency, currency)}</span>
          </div>
          <div className="flex justify-between text-slate-700 dark:text-slate-200">
            <span className="font-mono truncate max-w-[60%]">{datasets[1]}</span>
            <span className="tabular-nums font-medium">{formatNum(valB, isCurrency, currency)}</span>
          </div>
        </div>
      </div>
    );
  }

  // 3+ datasets: 列表
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
      <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-300 uppercase tracking-wider">
        {kpi.label}
      </div>
      <div className="mt-2 space-y-1 text-xs">
        {datasets.map((ds: string, i: number) => (
          <div key={ds} className="flex justify-between">
            <span className="font-mono truncate max-w-[60%] flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: COMPARE_COLORS[i % COMPARE_COLORS.length] }} />
              {ds}
            </span>
            <span className="tabular-nums font-medium text-slate-700 dark:text-slate-200">
              {formatNum(byDataset[ds] || 0, isCurrency, currency)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}


function CompareTrendChart({ trend, datasets, isCurrency, currency }: {
  trend: Record<string, Array<{ month: string; value: number }>>;
  datasets: string[];
  isCurrency: boolean;
  currency: string;
}) {
  const { t } = useI18n();
  // 把多个 dataset 的 points 合并成一个 recharts-friendly 的格式
  // [{ month: "2025-01", march_sales: 100, april_sales: 120 }, ...]
  const allMonths = new Set<string>();
  Object.values(trend).forEach(pts => pts.forEach(p => allMonths.add(p.month.slice(0, 7))));
  const sortedMonths = Array.from(allMonths).sort();
  const merged = sortedMonths.map(m => {
    const row: any = { month: m };
    datasets.forEach(ds => {
      const pt = (trend[ds] || []).find(p => p.month.slice(0, 7) === m);
      row[ds] = pt ? pt.value : null;
    });
    return row;
  });

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-200">
          {t('compare.trend_title')}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={merged} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatNum(v, isCurrency, currency)} />
          <Tooltip formatter={(v: number) => formatNum(v, isCurrency, currency)} />
          {datasets.map((ds, i) => (
            <Line
              key={ds}
              type="monotone"
              dataKey={ds}
              stroke={COMPARE_COLORS[i % COMPARE_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-3 flex flex-wrap gap-3 text-xs">
        {datasets.map((ds, i) => (
          <div key={ds} className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5" style={{ backgroundColor: COMPARE_COLORS[i % COMPARE_COLORS.length] }} />
            <span className="font-mono text-slate-700 dark:text-slate-200">{ds}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

