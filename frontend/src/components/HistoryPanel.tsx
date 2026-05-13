import { History, FileDown, X, Loader2 } from 'lucide-react';
import { useState } from 'react';
import type { AnswerResponse } from '../types';
import { api } from '../api';

interface Props {
  sessionId: string;
  history: AnswerResponse[];
  onSelect: (id: number) => void;
  onClose: () => void;
}

export function HistoryPanel({ sessionId, history, onSelect, onClose }: Props) {
  const [exporting, setExporting] = useState(false);

  const exportAllMarkdown = async () => {
    if (history.length === 0) return;
    setExporting(true);
    try {
      const md = await api.exportMarkdown(sessionId, null);
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `whalebase_report_${new Date().toISOString().slice(0, 10)}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <aside className="w-72 border-l border-slate-200 bg-white flex flex-col h-full shrink-0">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <History className="w-3.5 h-3.5 text-slate-500" />
          <h2 className="label">查询历史</h2>
          <span className="chip">{history.length}</span>
        </div>
        <button onClick={onClose} className="btn-ghost !p-1">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {history.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">
            还没有查询历史
          </div>
        ) : (
          history.slice().reverse().map((h) => (
            <button
              key={h.id}
              onClick={() => onSelect(h.id)}
              className="block w-full text-left p-2.5 rounded-md
                         border border-slate-100 hover:border-brand-200 hover:bg-brand-50/30
                         transition-all"
            >
              <div className="flex items-baseline gap-1.5 mb-0.5">
                <span className="text-[10px] font-mono text-slate-400">#{h.id + 1}</span>
                <span className="text-[10px] text-slate-400">·</span>
                <span className="text-[10px] text-slate-400">{h.result.row_count} 行</span>
              </div>
              <div className="text-xs text-slate-800 line-clamp-2 leading-relaxed">
                {h.question}
              </div>
            </button>
          ))
        )}
      </div>

      {history.length > 0 && (
        <div className="px-3 py-2 border-t border-slate-100">
          <button
            onClick={exportAllMarkdown}
            disabled={exporting}
            className="btn-secondary w-full"
          >
            {exporting ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                导出中...
              </>
            ) : (
              <>
                <FileDown className="w-3 h-3" />
                导出 Markdown 报告
              </>
            )}
          </button>
        </div>
      )}
    </aside>
  );
}
