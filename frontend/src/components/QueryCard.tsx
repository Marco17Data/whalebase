import { useState } from 'react';
import {
  Sparkles, Code2, Edit3, Play, Download, BarChart3,
  Table2, LineChart as LineIcon, PieChart as PieIcon,
  Activity, Loader2,
} from 'lucide-react';
import type { AnswerResponse, QueryResult, ChartType } from '../types';
import { SmartChart, inferAvailableChartTypes } from './SmartChart';
import { api } from '../api';

interface Props {
  answer: AnswerResponse;
  sessionId: string;
  currency: string;
  index: number;
}

const CHART_LABELS: Record<ChartType, { label: string; icon: any }> = {
  bar:     { label: 'bar', icon: BarChart3 },
  line:    { label: 'line', icon: LineIcon },
  area:    { label: 'area', icon: Activity },
  pie:     { label: 'pie', icon: PieIcon },
  scatter: { label: 'scatter', icon: Activity },
  table:   { label: 'table', icon: Table2 },
  kpi:     { label: 'kpi', icon: BarChart3 },
};

export function QueryCard({ answer, sessionId, currency, index }: Props) {
  const [showSQL, setShowSQL] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editedSQL, setEditedSQL] = useState(answer.sql);
  const [currentResult, setCurrentResult] = useState<QueryResult>(answer.result);
  const [chartType, setChartType] = useState<ChartType>(answer.chart_hint);
  const [rerunning, setRerunning] = useState(false);
  const [rerunError, setRerunError] = useState<string | null>(null);

  // 根据当前结果推断哪些图表可用
  const availableCharts = inferAvailableChartTypes(currentResult);

  // 如果当前选的图表类型已经不可用，自动切到第一个可用的
  if (!availableCharts.includes(chartType)) {
    setTimeout(() => setChartType(availableCharts[0]), 0);
  }

  const handleRerun = async () => {
    setRerunning(true);
    setRerunError(null);
    try {
      const res = await api.runSQL(sessionId, editedSQL);
      setCurrentResult(res.result);
      setEditing(false);
    } catch (e) {
      setRerunError((e as Error).message);
    } finally {
      setRerunning(false);
    }
  };

  const downloadCSV = () => {
    const csv = [
      currentResult.columns.join(','),
      ...currentResult.rows.map((row) =>
        row
          .map((cell) => {
            if (cell === null || cell === undefined) return '';
            const s = String(cell);
            return s.includes(',') || s.includes('"')
              ? `"${s.replace(/"/g, '""')}"`
              : s;
          })
          .join(',')
      ),
    ].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query_${index + 1}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <article className="card-shadow p-5 animate-slide-up">
      {/* 问题 */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-6 h-6 rounded-md bg-brand-900 text-white flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5 font-mono">
          {index + 1}
        </div>
        <h3 className="text-base font-semibold text-slate-900 leading-snug flex-1">
          {answer.question}
        </h3>
      </div>

      {/* SQL 区 */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => setShowSQL(!showSQL)} className="btn-ghost">
            <Code2 className="w-3 h-3" />
            {showSQL ? '隐藏 SQL' : '查看 SQL'}
          </button>
          {showSQL && (
            <div className="flex items-center gap-1">
              {editing ? (
                <>
                  <button
                    onClick={handleRerun}
                    disabled={rerunning}
                    className="btn-ghost !text-accent-600"
                  >
                    {rerunning ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Play className="w-3 h-3" />
                    )}
                    {rerunning ? '执行中...' : '执行'}
                  </button>
                  <button
                    onClick={() => {
                      setEditing(false);
                      setEditedSQL(answer.sql);
                      setRerunError(null);
                    }}
                    className="btn-ghost"
                  >
                    取消
                  </button>
                </>
              ) : (
                <button onClick={() => setEditing(true)} className="btn-ghost">
                  <Edit3 className="w-3 h-3" /> 编辑
                </button>
              )}
            </div>
          )}
        </div>

        {showSQL && (
          <div>
            {editing ? (
              <textarea
                value={editedSQL}
                onChange={(e) => setEditedSQL(e.target.value)}
                className="code-block w-full min-h-[120px] resize-y outline-none focus:ring-2 focus:ring-brand-300"
                spellCheck={false}
              />
            ) : (
              <pre className="code-block">{answer.sql}</pre>
            )}
            {answer.explanation && (
              <p className="text-xs text-slate-500 mt-2 italic">{answer.explanation}</p>
            )}
            {rerunError && (
              <div className="mt-2 text-xs text-danger bg-red-50 border border-red-200 px-2.5 py-1.5 rounded-md">
                {rerunError}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 图表 */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs text-slate-500">
            <span className="font-mono tabular-nums">
              {currentResult.row_count.toLocaleString()}
            </span>{' '}
            行结果
            {currentResult.truncated && (
              <span className="ml-1 text-amber-600">(已截断)</span>
            )}
          </div>
          {/* 只显示该数据能渲染的图表类型 */}
          {availableCharts.length > 1 && (
            <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-md">
              {availableCharts.map((type) => {
                const conf = CHART_LABELS[type];
                if (!conf) return null;
                const Icon = conf.icon;
                return (
                  <button
                    key={type}
                    onClick={() => setChartType(type)}
                    className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-colors
                      ${chartType === type
                        ? 'bg-white text-brand-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    <Icon className="w-3 h-3" />
                    {conf.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="bg-slate-50/50 rounded-md p-4 border border-slate-100">
          <SmartChart result={currentResult} chartType={chartType} currency={currency} />
        </div>
      </div>

      {/* 洞察 */}
      {answer.insight && (
        <div className="bg-accent-50/50 border-l-2 border-accent-500 rounded-r-md px-4 py-3 mb-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-accent-700 mb-1.5 uppercase tracking-wider">
            <Sparkles className="w-3 h-3" /> 洞察
          </div>
          <p className="text-sm text-slate-800 leading-relaxed">{answer.insight}</p>
        </div>
      )}

      {/* 操作栏 */}
      <div className="flex items-center justify-end gap-1 pt-3 border-t border-slate-100">
        <button onClick={downloadCSV} className="btn-ghost">
          <Download className="w-3 h-3" /> CSV
        </button>
      </div>
    </article>
  );
}
