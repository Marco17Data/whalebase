import { useI18n } from '../i18n';

interface DataQuality {
  row_count: number;
  col_count: number;
  duplicate_rows: number;
  duplicate_pct: number;
  columns_with_nulls: Array<{ name: string; null_count: number; null_pct: number }>;
}

export default function DataQualityBar({ data }: { data: DataQuality | null }) {
  const { t } = useI18n();
  if (!data) return null;

  const isPerfect = data.duplicate_rows === 0 && data.columns_with_nulls.length === 0;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-200">
          {t('dq.title')}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {data.row_count.toLocaleString()} {t('dq.rows')} · {data.col_count} {t('dq.cols')}
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
                        <div
                          className="h-full bg-amber-400 dark:bg-amber-500"
                          style={{ width: `${Math.min(c.null_pct, 100)}%` }}
                        />
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
  );
}
