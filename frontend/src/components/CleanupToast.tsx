import { useEffect, useState } from 'react';
import { CheckCircle2, Undo2 } from 'lucide-react';
import { useI18n } from '../i18n';

interface Props {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  durationMs?: number;
}

export default function CleanupToast({ message, onUndo, onDismiss, durationMs = 10000 }: Props) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const tid = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300);
    }, durationMs);
    return () => clearTimeout(tid);
  }, [durationMs, onDismiss]);

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      }`}
    >
      <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 px-4 py-3 rounded-xl shadow-lg">
        <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <div className="text-sm">{message}</div>
        <button
          onClick={onUndo}
          className="flex items-center gap-1 text-sm font-medium text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-100 pl-2 border-l border-emerald-200 dark:border-emerald-700"
        >
          <Undo2 className="w-4 h-4" />
          {t('cleanup.undo_btn')}
        </button>
      </div>
    </div>
  );
}
