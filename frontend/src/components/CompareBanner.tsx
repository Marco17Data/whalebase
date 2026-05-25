import { Sparkles, X } from 'lucide-react';
import { useI18n } from '../i18n';

interface Props {
  tables: string[];
  onCompare: () => void;
  onDismiss: () => void;
}

export default function CompareBanner({ tables, onCompare, onDismiss }: Props) {
  const { t } = useI18n();
  return (
    <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700 rounded-xl p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Sparkles className="w-5 h-5 text-violet-500 shrink-0" />
        <div>
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {t('compare.banner_title')}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
            {tables.join(' · ')}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onCompare}
          className="px-3 py-1.5 text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg"
        >
          {t('compare.banner_btn')}
        </button>
        <button
          onClick={onDismiss}
          className="p-1 rounded hover:bg-violet-100 dark:hover:bg-violet-800/30"
          title={t('compare.dismiss')}
        >
          <X className="w-4 h-4 text-slate-500" />
        </button>
      </div>
    </div>
  );
}
