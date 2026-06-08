import { useState } from 'react';
import { Code2, Play, X, AlertCircle, Loader2, Database } from 'lucide-react';
import type { QueryResult, TableInfo } from '../types';
import { api } from '../api';
import { SmartChart, inferAvailableChartTypes } from './SmartChart';

interface Props {
  sessionId: string;
  tables: TableInfo[];
  onClose: () => void;
}

export function SQLPlayground({ sessionId, tables, onClose }: Props) {
  const [sql, setSql] = useState(() => {
    if (tables.length === 0) return '-- 先上传文件';
    const t = tables[0];
    return `SELECT * FROM "${t.name}" LIMIT 10;`;
  });
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await api.runSQL(sessionId, sql);
      setResult(res.result);
    } catch (e) {
      setError((e as Error).message);
      setResult(null);
    } finally {
      setRunning(false);
    }
  };

  const insertSnippet = (snippet: string) => {
    setSql(snippet);
  };

  const chartType = result ? inferAvailableChartTypes(result)[0] : 'table';

  return (
    <aside className="w-[480px] border-l border-slate-200 bg-white flex flex-col h-full shrink-0">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Code2 className="w-3.5 h-3.5 text-slate-500" />
          <h2 className="label">SQL Playground</h2>
          <span className="chip">DuckDB</span>
        </div>
        <button onClick={onClose} className="btn-ghost !p-1">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* 表 schema 提示 */}
        {tables.length > 0 && (
          <div className="card p-3 bg-slate-50/50">
            <div className="flex items-center gap-1.5 mb-2">
              <Database className="w-3 h-3 text-slate-500" />
              <span className="label">可用表</span>
            </div>
            <div className="space-y-1.5">
              {tables.map((t) => (
                <div key={t.name} className="text-[11px] font-mono">
                  <button
                    onClick={() => insertSnippet(`SELECT * FROM "${t.name}" LIMIT 100;`)}
                    className="text-brand-700 hover:text-brand-900 hover:underline"
                  >
                    {t.name}
                  </button>
                  <span className="text-slate-400 ml-2">
                    ({t.columns.map((c) => c.name).slice(0, 4).join(', ')}
                    {t.columns.length > 4 ? '...' : ''})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SQL 输入 */}
        <div>
          <label className="label mb-1.5 block">SQL 查询</label>
          <textarea
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                handleRun();
              }
            }}
            spellCheck={false}
            className="code-block w-full min-h-[140px] resize-y outline-none focus:ring-2 focus:ring-brand-300"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-slate-400">
              <kbd>⌘ + Enter</kbd> 执行
            </span>
            <button
              onClick={handleRun}
              disabled={running || !sql.trim() || tables.length === 0}
              className="btn-accent"
            >
              {running ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Play className="w-3 h-3" />
              )}
              {running ? '执行中...' : '执行 SQL'}
            </button>
          </div>
        </div>

        {/* 错误 */}
        {error && (
          <div className="card p-3 bg-red-50 border-red-200">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-danger mt-0.5 shrink-0" />
              <p className="text-xs text-red-900 leading-relaxed whitespace-pre-wrap">
                {error}
              </p>
            </div>
          </div>
        )}

        {/* 结果 */}
        {result && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label">结果</label>
              <span className="text-[10px] text-slate-400 font-mono tabular-nums">
                {result.row_count.toLocaleString()} 行
                {result.truncated && ' · 已截断'}
              </span>
            </div>
            <div className="bg-slate-50/50 rounded-md p-2 border border-slate-100">
              <SmartChart result={result} chartType={chartType} />
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
