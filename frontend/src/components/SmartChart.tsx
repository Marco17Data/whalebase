import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  ScatterChart, Scatter, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import type { QueryResult, ChartType } from '../types';
import { useI18n } from '../i18n';
import { getCurrencySymbol, formatValue as fmt } from '../lib/format';

interface Props {
  result: QueryResult & { currency_cols?: string[] };
  chartType: ChartType;
  currency?: string | null;
}

const PALETTE = [
  '#1e3a8a', '#f59e0b', '#4338ca', '#0891b2',
  '#7c3aed', '#059669', '#dc2626', '#64748b',
];
const AXIS_STYLE = { fontSize: 11, fontFamily: 'Inter, sans-serif', fill: '#64748b' };
const TOOLTIP_STYLE = {
  backgroundColor: '#ffffff', border: '1px solid #e2e8f0',
  borderRadius: '8px', fontSize: '12px', fontFamily: 'Inter, sans-serif',
  boxShadow: '0 4px 16px rgba(15, 23, 42, 0.08)', padding: '8px 12px',
};

export function inferAvailableChartTypes(result: QueryResult): ChartType[] {
  if (!result.rows || result.rows.length === 0) return ['table'];
  if (result.rows.length === 1 && result.columns.length === 1) return ['kpi', 'table'];
  if (result.columns.length > 6) return ['table'];

  const firstColValues = result.rows.map((r) => r[0]);
  const firstColIsDate = firstColValues.every(
    (v) => v !== null && (typeof v === 'string' && /^\d{4}-\d{2}/.test(String(v)))
  );
  if (firstColIsDate) return ['line', 'area', 'bar', 'table'];
  return ['bar', 'line', 'area', 'pie', 'table'];
}

export function SmartChart({ result, chartType, currency }: Props) {
  const { t } = useI18n();
  const currencyCols = result.currency_cols || [];

  const isCurrencyCol = (col: string) => currencyCols.includes(col);
  const formatForCol = (col: string, v: any, compact = false) =>
    fmt(v, { currency, isCurrencyCol: isCurrencyCol(col), compact });

  if (!result.rows || result.rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        {t('common.error')}
      </div>
    );
  }

  // KPI
  if (chartType === 'kpi') {
    const value = result.rows[0][0];
    const colName = result.columns[0];
    return (
      <div className="flex flex-col items-center justify-center min-h-[120px] gap-1.5 py-4">
        <div className="label text-slate-500">{colName}</div>
        <div className="text-4xl heading-display text-brand-900 leading-none">
          {formatForCol(colName, value, true)}
        </div>
      </div>
    );
  }

  if (chartType === 'table') {
    return <DataTable result={result} currency={currency} />;
  }

  const data = result.rows.map((row) => {
    const obj: Record<string, any> = {};
    result.columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
  const xKey = result.columns[0];
  const numericCols = result.columns.slice(1).filter((col) =>
    data.some((row) => typeof row[col] === 'number')
  );

  if (numericCols.length === 0) return <DataTable result={result} currency={currency} />;

  // Y 轴格式化（compact 形式：$1.5K, 2.3M etc.）
  const yTickFormatter = (v: any) => {
    const anyCurrency = numericCols.some(isCurrencyCol);
    return fmt(v, { currency, isCurrencyCol: anyCurrency, compact: true });
  };
  // Tooltip 格式化：值 → 带货币
  const tooltipFormatter = (value: any, name: any) => {
    return [formatForCol(String(name), value), String(name)];
  };

  switch (chartType) {
    case 'line':
      return (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey={xKey} tick={AXIS_STYLE} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
            <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} tickFormatter={yTickFormatter} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={tooltipFormatter}
              cursor={{ stroke: '#cbd5e1', strokeDasharray: '3 3' }} />
            {numericCols.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
            {numericCols.map((col, i) => (
              <Line key={col} type="monotone" dataKey={col}
                stroke={PALETTE[i % PALETTE.length]} strokeWidth={2}
                dot={{ r: 3, fill: PALETTE[i % PALETTE.length] }} activeDot={{ r: 5 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      );

    case 'area':
      return (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <defs>
              {numericCols.map((col, i) => (
                <linearGradient key={col} id={`grad-${i}-${col}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={PALETTE[i % PALETTE.length]} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={PALETTE[i % PALETTE.length]} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey={xKey} tick={AXIS_STYLE} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
            <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} tickFormatter={yTickFormatter} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={tooltipFormatter} />
            {numericCols.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
            {numericCols.map((col, i) => (
              <Area key={col} type="monotone" dataKey={col}
                stroke={PALETTE[i % PALETTE.length]} strokeWidth={2}
                fill={`url(#grad-${i}-${col})`} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      );

    case 'bar':
      return (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey={xKey} tick={AXIS_STYLE} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
            <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} tickFormatter={yTickFormatter} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={tooltipFormatter}
              cursor={{ fill: '#f8fafc' }} />
            {numericCols.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
            {numericCols.map((col, i) => (
              <Bar key={col} dataKey={col} fill={PALETTE[i % PALETTE.length]} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      );

    case 'pie': {
      const pieData = data.map((row) => ({
        name: row[xKey],
        value: row[numericCols[0]],
      }));
      const measureCol = numericCols[0];
      return (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                 outerRadius={90} innerRadius={45} paddingAngle={2}>
              {pieData.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE}
              formatter={(v: any) => [formatForCol(measureCol, v), measureCol]} />
            <Legend
              layout="vertical" verticalAlign="middle" align="right"
              wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    case 'scatter':
      return (
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="#f1f5f9" />
            <XAxis type="number" dataKey={xKey} tick={AXIS_STYLE} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
            <YAxis type="number" dataKey={numericCols[0]} tick={AXIS_STYLE} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={tooltipFormatter}
              cursor={{ strokeDasharray: '3 3' }} />
            <Scatter data={data} fill={PALETTE[0]} />
          </ScatterChart>
        </ResponsiveContainer>
      );

    default:
      return <DataTable result={result} currency={currency} />;
  }
}

// 表格
export function DataTable({
  result, currency,
}: { result: QueryResult & { currency_cols?: string[] }; currency?: string | null }) {
  const maxRows = 100;
  const displayRows = result.rows.slice(0, maxRows);
  const currencyCols = result.currency_cols || [];
  const isCurrencyCol = (c: string) => currencyCols.includes(c);

  return (
    <div className="overflow-auto max-h-[400px] rounded-md border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
          <tr>
            {result.columns.map((col) => (
              <th key={col}
                className="text-left font-medium text-slate-700 px-3 py-2 whitespace-nowrap text-xs uppercase tracking-wide">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {displayRows.map((row, i) => (
            <tr key={i} className="hover:bg-slate-50">
              {row.map((cell, j) => {
                const colName = result.columns[j];
                const isCurr = isCurrencyCol(colName);
                return (
                  <td key={j}
                    className="px-3 py-2 text-slate-800 whitespace-nowrap font-mono text-xs">
                    {cell === null || cell === undefined ? (
                      <span className="text-slate-300">—</span>
                    ) : typeof cell === 'number' ? (
                      <>{isCurr && getCurrencySymbol(currency)}{formatCell(cell)}</>
                    ) : (
                      formatCell(cell)
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {result.rows.length > maxRows && (
        <div className="px-3 py-2 text-xs text-slate-500 bg-slate-50 border-t border-slate-200">
          {maxRows} / {result.row_count}
        </div>
      )}
    </div>
  );
}

function formatCell(v: any): string {
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return v.toLocaleString();
    return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }
  return String(v);
}

// 兼容旧的 import { formatValue }
export function formatValue(v: any): string {
  return fmt(v);
}
