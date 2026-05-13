import { useState, useMemo } from 'react';
import { X, Play, Loader2, Filter, Grip, ChevronRight } from 'lucide-react';
import type { TableInfo, PivotConfig, QueryResult } from '../types';
import { api } from '../api';
import { useI18n } from '../i18n';
import { SmartChart } from './SmartChart';

interface Props {
  sessionId: string;
  tables: TableInfo[];
  currency: string;
  onClose: () => void;
}

const AGGREGATIONS: PivotConfig['agg'][] = ['sum', 'avg', 'count', 'count_distinct', 'min', 'max'];

export function PivotView({ sessionId, tables, currency, onClose }: Props) {
  const { t } = useI18n();
  const [tableName, setTableName] = useState<string>(tables[0]?.name || '');
  const [rows, setRows] = useState<string[]>([]);
  const [cols, setCols] = useState<string[]>([]);
  const [measure, setMeasure] = useState<string | null>(null);
  const [agg, setAgg] = useState<PivotConfig['agg']>('sum');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentTable = tables.find((t) => t.name === tableName);

  const availableFields = useMemo(() => {
    if (!currentTable) return [];
    const used = new Set([...rows, ...cols, ...(measure ? [measure] : [])]);
    return currentTable.columns.filter((c) => !used.has(c.name));
  }, [currentTable, rows, cols, measure]);

  const handleDragStart = (e: React.DragEvent, colName: string, source: string) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ colName, source }));
  };

  const handleDrop = (target: 'rows' | 'cols' | 'measure', e: React.DragEvent) => {
    e.preventDefault();
    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
    const colName = data.colName as string;
    const source = data.source as string;

    // 从源移除
    if (source === 'rows') setRows((r) => r.filter((x) => x !== colName));
    if (source === 'cols') setCols((c) => c.filter((x) => x !== colName));
    if (source === 'measure') setMeasure(null);

    // 加到目标
    if (target === 'rows') setRows((r) => [...r, colName]);
    if (target === 'cols') setCols((c) => [...c, colName]);
    if (target === 'measure') setMeasure(colName);
  };

  const removeFrom = (target: 'rows' | 'cols' | 'measure', colName: string) => {
    if (target === 'rows') setRows((r) => r.filter((x) => x !== colName));
    if (target === 'cols') setCols((c) => c.filter((x) => x !== colName));
    if (target === 'measure') setMeasure(null);
  };

  const run = async () => {
    if (!currentTable) return;
    setRunning(true);
    setError(null);
    try {
      const res = await api.runPivot(sessionId, {
        table: tableName,
        rows,
        columns: cols,
        measure,
        agg,
        filters: [],
      });
      setResult(res.result);
    } catch (e) {
      setError((e as Error).message);
      setResult(null);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-6 animate-fade-in">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="btn-ghost">
            <ChevronRight className="w-3 h-3 rotate-180" />
            {t('dashboard.back')}
          </button>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
            {t('dashboard.pivot_title')}
          </h1>
        </div>
        {tables.length > 1 && (
          <select
            value={tableName}
            onChange={(e) => {
              setTableName(e.target.value);
              setRows([]); setCols([]); setMeasure(null); setResult(null);
            }}
            className="input-base !w-auto !text-xs"
          >
            {tables.map((t) => (
              <option key={t.name} value={t.name}>{t.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* 可用字段 */}
        <div className="card p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
            {t('pivot.available_fields')}
          </div>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {availableFields.map((col) => (
              <div
                key={col.name}
                draggable
                onDragStart={(e) => handleDragStart(e, col.name, 'available')}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-slate-100
                           hover:border-brand-300 hover:bg-brand-50/30 cursor-move text-xs"
              >
                <Grip className="w-3 h-3 text-slate-300" />
                <span className="font-mono text-slate-700 truncate flex-1">{col.name}</span>
                <span className="text-[9px] uppercase text-slate-400">{shortType(col.dtype)}</span>
              </div>
            ))}
            {availableFields.length === 0 && (
              <div className="text-[11px] text-slate-400 italic text-center py-4">
                All fields used
              </div>
            )}
          </div>
        </div>

        {/* 配置区 */}
        <div className="lg:col-span-3 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <DropZone
              label={t('pivot.rows')}
              items={rows}
              onDrop={(e) => handleDrop('rows', e)}
              onRemove={(c) => removeFrom('rows', c)}
              onDragStart={(c) => (e: React.DragEvent) => handleDragStart(e, c, 'rows')}
            />
            <DropZone
              label={t('pivot.columns')}
              items={cols}
              onDrop={(e) => handleDrop('cols', e)}
              onRemove={(c) => removeFrom('cols', c)}
              onDragStart={(c) => (e: React.DragEvent) => handleDragStart(e, c, 'cols')}
            />
            <DropZone
              label={t('pivot.measure')}
              items={measure ? [measure] : []}
              onDrop={(e) => handleDrop('measure', e)}
              onRemove={(c) => removeFrom('measure', c)}
              onDragStart={(c) => (e: React.DragEvent) => handleDragStart(e, c, 'measure')}
              max={1}
            />
          </div>

          {/* 聚合方式 + 执行按钮 */}
          <div className="card p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-600">{t('pivot.agg')}:</label>
              <select
                value={agg}
                onChange={(e) => setAgg(e.target.value as PivotConfig['agg'])}
                className="input-base !w-auto !text-xs !py-1"
              >
                {AGGREGATIONS.map((a) => (
                  <option key={a} value={a}>{t(`pivot.agg.${a}`)}</option>
                ))}
              </select>
            </div>
            <button
              onClick={run}
              disabled={running || (rows.length === 0 && cols.length === 0)}
              className="btn-accent"
            >
              {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              {t('pivot.run')}
            </button>
          </div>

          {error && (
            <div className="card p-3 bg-red-50 border-red-200 text-xs text-red-900">
              {error}
            </div>
          )}

          {/* 结果 */}
          {result && (
            <div className="card p-4">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">
                Result · {result.row_count} rows
              </div>
              <SmartChart result={result} chartType="table" currency={currency} />
            </div>
          )}
          {!result && !error && (
            <div className="text-center py-12 text-sm text-slate-400 italic">
              {t('pivot.no_result')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DropZone({
  label, items, onDrop, onRemove, onDragStart, max,
}: {
  label: string;
  items: string[];
  onDrop: (e: React.DragEvent) => void;
  onRemove: (c: string) => void;
  onDragStart: (c: string) => (e: React.DragEvent) => void;
  max?: number;
}) {
  const { t } = useI18n();
  const [hover, setHover] = useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setHover(true); }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => { setHover(false); if (!max || items.length < max) onDrop(e); }}
      className={`card p-3 min-h-[120px] transition-all
        ${hover ? 'border-brand-500 bg-brand-50/40' : ''}`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
        {label}
      </div>
      {items.length === 0 ? (
        <div className="text-[11px] text-slate-400 italic text-center py-4 border-2 border-dashed border-slate-200 rounded">
          {t('pivot.drop_here')}
        </div>
      ) : (
        <div className="space-y-1">
          {items.map((c) => (
            <div
              key={c}
              draggable
              onDragStart={onDragStart(c)}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-brand-50 border border-brand-200 cursor-move"
            >
              <Grip className="w-3 h-3 text-brand-400" />
              <span className="font-mono text-xs text-brand-900 truncate flex-1">{c}</span>
              <button onClick={() => onRemove(c)} className="text-brand-400 hover:text-danger">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function shortType(t: string): string {
  return ({ integer: 'int', float: 'num', text: 'str', datetime: 'date', boolean: 'bool' } as Record<string, string>)[t] || t;
}
