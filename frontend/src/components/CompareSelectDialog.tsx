import { useState } from 'react';
import { X, GitCompare, Loader2 } from 'lucide-react';
import { useI18n } from '../i18n';
import { api } from '../api';
import type { TableInfo } from '../types';

interface Props {
  sessionId: string;
  tables: TableInfo[];
  onClose: () => void;
  onApplied: () => void;
}

export function CompareSelectDialog({ sessionId, tables, onClose, onApplied }: Props) {
  const { t } = useI18n();
  // 排除内部表
  const realTables = tables.filter((t) => !t.name.startsWith('__'));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(name: string) {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setSelected(next);
  }

  async function handleApply() {
    if (selected.size < 2) return;
    setApplying(true);
    setError(null);
    try {
      const r = await api.enableCompare(sessionId, Array.from(selected));
      if (!r.ok) throw new Error(r.error || 'failed');
      onApplied();
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full max-h-[85vh] overflow-y-auto border border-slate-200 dark:border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-violet-500" />
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              {t('compare.select_title')}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="px-6 py-4">
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
            {t('compare.select_subtitle')}
          </p>

          {realTables.length < 2 ? (
            <div className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">
              {t('compare.select_need_two')}
            </div>
          ) : (
            <ul className="space-y-2">
              {realTables.map((tbl) => (
                <li key={tbl.name}>
                  <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-500 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.has(tbl.name)}
                      onChange={() => toggle(tbl.name)}
                      className="h-4 w-4 rounded text-violet-600 focus:ring-violet-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                        {tbl.name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {tbl.row_count.toLocaleString()} {t('dq.rows')} · {tbl.columns.length} {t('dq.cols')}
                      </div>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
          )}

          {error && <div className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</div>}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 rounded-b-2xl">
          <button onClick={onClose} disabled={applying}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-50">
            {t('cleanup.cancel')}
          </button>
          <button onClick={handleApply} disabled={applying || selected.size < 2}
            className="px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg disabled:opacity-50 flex items-center gap-1.5">
            {applying && <Loader2 className="w-4 h-4 animate-spin" />}
            {applying ? t('cleanup.applying') : t('compare.banner_btn')}
          </button>
        </div>
      </div>
    </div>
  );
}
