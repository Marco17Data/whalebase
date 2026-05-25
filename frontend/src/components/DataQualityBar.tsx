import { useState, useEffect } from 'react';
import { Sparkles, Undo2 } from 'lucide-react';
import { useI18n } from '../i18n';
import { api } from '../api';
import CleanupDialog from './CleanupDialog';
import CleanupToast from './CleanupToast';

interface DataQuality {
  row_count: number;
  col_count: number;
  duplicate_rows: number;
  duplicate_pct: number;
  columns_with_nulls: Array<{ name: string; null_count: number; null_pct: number }>;
}

interface Props {
  data: DataQuality | null;
  sessionId?: string;
  tableName?: string;
  onAfterCleanup?: () => void;
}

export default function DataQualityBar({ data, sessionId, tableName, onAfterCleanup }: Props) {
  const { t, lang } = useI18n();
  const [showDialog, setShowDialog] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [loadingSugg, setLoadingSugg] = useState(false);
  const [hasSnapshot, setHasSnapshot] = useState(false);

  // 每次 data 变化时, 检查后端 snapshot 状态 (决定要不要显示"还原"按钮)
  useEffect(() => {
    if (!sessionId) return;
    api.getCleanupStatus(sessionId, tableName)
      .then((r) => setHasSnapshot(r.has_snapshot))
      .catch(() => setHasSnapshot(false));
  }, [sessionId, tableName, data]);

  if (!data) return null;

  const isPerfect = data.duplicate_rows === 0 && data.columns_with_nulls.length === 0;

  async function openDialog() {
    if (!sessionId) return;
    setLoadingSugg(true);
    try {
      const r = await api.getCleanupSuggestions(sessionId, lang, tableName);
      setSuggestions(r.suggestions);
      setShowDialog(true);
    } finally {
      setLoadingSugg(false);
    }
  }

  function handleApplied(newRowCount: number) {
    setShowDialog(false);
    setToastMsg(t('cleanup.toast_done').replace('{rows}', newRowCount.toLocaleString()));
    onAfterCleanup?.();
  }

  async function handleUndo() {
    if (!sessionId) return;
    try {
      await api.undoCleanup(sessionId, tableName);
      setToastMsg(null);
      setHasSnapshot(false);
      onAfterCleanup?.();
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <>
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-300 uppercase tracking-wider">
              {t('dq.title')}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {data.row_count.toLocaleString()} {t('dq.rows')} · {data.col_count} {t('dq.cols')}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasSnapshot && sessionId && (
              <button
                onClick={handleUndo}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                title={t('cleanup.undo_persistent_hint')}
              >
                <Undo2 className="w-3.5 h-3.5" />
                {t('cleanup.undo_btn')}
              </button>
            )}
            {!isPerfect && sessionId && (
              <button
                onClick={openDialog}
                disabled={loadingSugg}
                className="flex items-center gap-1.5 text-xs font-medium text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-200 px-3 py-1.5 rounded-lg border border-violet-200 dark:border-violet-700 hover:bg-violet-50 dark:hover:bg-violet-900/30 disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {loadingSugg ? '…' : t('cleanup.open_btn')}
              </button>
            )}
          </div>
        </div>

        {isPerfect ? (
          <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
            <span>✓</span>
            <span>{t('dq.perfect')}</span>
          </div>
        ) : (
          <div className="space-y-2">
            {data.duplicate_rows > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-700 dark:text-slate-300">
                  {data.duplicate_rows.toLocaleString()} {t('dq.duplicates')}
                </span>
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  {data.duplicate_pct}%
                </span>
              </div>
            )}

            {data.columns_with_nulls.length > 0 && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                  {t('dq.nulls_in')}
                </div>
                <div className="space-y-1.5">
                  {data.columns_with_nulls.map((c) => (
                    <div key={c.name} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700 dark:text-slate-300 font-mono text-xs truncate max-w-[60%]">
                        {c.name}
                      </span>
                      <div className="flex items-center gap-2 flex-1 ml-3">
                        <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-400 dark:bg-amber-500"
                            style={{ width: `${Math.min(c.null_pct, 100)}%` }} />
                        </div>
                        <span className="text-xs text-amber-600 dark:text-amber-400 font-medium tabular-nums w-12 text-right">
                          {c.null_pct}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showDialog && sessionId && (
        <CleanupDialog
          sessionId={sessionId}
          table={tableName}
          suggestions={suggestions}
          rowCount={data.row_count}
          onClose={() => setShowDialog(false)}
          onApplied={handleApplied}
        />
      )}

      {toastMsg && (
        <CleanupToast
          message={toastMsg}
          onUndo={handleUndo}
          onDismiss={() => setToastMsg(null)}
          durationMs={5000}
        />
      )}
    </>
  );
}
