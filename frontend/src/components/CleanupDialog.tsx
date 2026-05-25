import { useState } from 'react';
import { X, Sparkles, Loader2 } from 'lucide-react';
import { useI18n } from '../i18n';
import { api } from '../api';

interface Suggestion {
  id: string;
  type: 'duplicates' | 'nulls';
  count: number;
  column?: string;
  fill_strategy?: 'zero' | 'placeholder';
  after_rows?: number;
}

interface Props {
  sessionId: string;
  table?: string;
  suggestions: Suggestion[];
  rowCount: number;
  onClose: () => void;
  onApplied: (newRowCount: number) => void;
}

export default function CleanupDialog({ sessionId, table, suggestions, rowCount, onClose, onApplied }: Props) {
  const { t, lang } = useI18n();
  const [selected, setSelected] = useState<Set<string>>(new Set(suggestions.map(s => s.id)));
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function handleApply() {
    setApplying(true);
    setError(null);
    try {
      const result = await api.applyCleanup(sessionId, Array.from(selected), lang, table);
      if (!result.ok) throw new Error(result.error || 'failed');
      onApplied(result.new_row_count ?? rowCount);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setApplying(false);
    }
  }

  function describeSuggestion(s: Suggestion): string {
    if (s.type === 'duplicates') {
      return t('cleanup.suggest_dedup')
        .replace('{count}', s.count.toLocaleString())
        .replace('{after}', (s.after_rows ?? 0).toLocaleString());
    }
    if (s.fill_strategy === 'zero') {
      return t('cleanup.suggest_fill_zero')
        .replace('{count}', s.count.toLocaleString())
        .replace('{col}', s.column ?? '');
    }
    return t('cleanup.suggest_fill_placeholder')
      .replace('{count}', s.count.toLocaleString())
      .replace('{col}', s.column ?? '');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto border border-slate-200 dark:border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-500" />
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              {t('cleanup.dialog_title')}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
            {t('cleanup.dialog_subtitle')}
          </p>

          {suggestions.length === 0 ? (
            <div className="text-sm text-emerald-600 dark:text-emerald-400 py-4 text-center">
              ✓ {t('dq.perfect')}
            </div>
          ) : (
            <ul className="space-y-3">
              {suggestions.map((s) => (
                <li key={s.id}>
                  <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-500 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.has(s.id)}
                      onChange={() => toggle(s.id)}
                      className="mt-0.5 h-4 w-4 rounded text-violet-600 focus:ring-violet-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                      {describeSuggestion(s)}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <span>ⓘ</span>
            <span>{t('cleanup.undo_hint')}</span>
          </div>

          {error && (
            <div className="mt-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 rounded-b-2xl">
          <button
            onClick={onClose}
            disabled={applying}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            {t('cleanup.cancel')}
          </button>
          <button
            onClick={handleApply}
            disabled={applying || selected.size === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg disabled:opacity-50 flex items-center gap-1.5"
          >
            {applying && <Loader2 className="w-4 h-4 animate-spin" />}
            {applying ? t('cleanup.applying') : t('cleanup.apply_btn')}
          </button>
        </div>
      </div>
    </div>
  );
}
