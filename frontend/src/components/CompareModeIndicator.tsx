import { GitCompare } from 'lucide-react';
import { useI18n } from '../i18n';

interface Props {
  sourceTables: string[];
  onExit: () => void;
}

export default function CompareModeIndicator({ sourceTables, onExit }: Props) {
  const { t } = useI18n();
  return (
    <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-xl px-4 py-2.5 flex items-center justify-between">
      <div className="flex items-center gap-2.5 min-w-0">
        <GitCompare className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <div className="text-sm text-slate-700 dark:text-slate-200 truncate">
          <span className="font-medium">{t('compare.indicator_label')}</span>
          <span className="text-slate-500 dark:text-slate-400 mx-2">·</span>
          <span className="font-mono text-xs">{sourceTables.join(' · ')}</span>
        </div>
      </div>
      <button
        onClick={onExit}
        className="px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-800/30 rounded-lg shrink-0"
      >
        {t('compare.exit_btn')}
      </button>
    </div>
  );
}
