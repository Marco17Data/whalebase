import { useCallback, useEffect, useState } from 'react';
import { Calendar, FileSpreadsheet, Loader2, RefreshCw, Trash2, Upload, X } from 'lucide-react';
import { api } from '../api';
import { useI18n } from '../i18n';

interface StoredFile {
  id: string;
  filename: string;
  storage_path: string;
  size_bytes: number;
  row_count: number | null;
  col_count: number | null;
  created_at: string;
}

interface Props {
  sessionId: string;
  onTablesChanged: () => Promise<void>;
  onClose: () => void;
}

export function MyFilesPanel({ sessionId, onTablesChanged, onClose }: Props) {
  const { t, lang } = useI18n();
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.listMyFiles();
      setFiles(result.files);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleLoad = async (fileId: string) => {
    setLoadingId(fileId);
    setError(null);
    try {
      await api.loadPersistedFile(sessionId, fileId);
      await onTablesChanged();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (fileId: string) => {
    setDeletingId(fileId);
    setError(null);
    try {
      await api.deleteMyFile(fileId);
      await fetchFiles();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(lang, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex justify-end animate-fade-in"
      onClick={onClose}
      role="presentation"
    >
      <aside
        className="h-full w-full max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('files.my_files')}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-brand-600 dark:text-brand-300" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {t('files.my_files')}
            </h2>
          </div>
          <button onClick={onClose} className="btn-ghost !p-1.5" title={t('common.close')}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="h-full min-h-48 flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('common.loading')}
            </div>
          ) : error ? (
            <div className="min-h-48 flex flex-col items-center justify-center text-center px-6">
              <div className="text-sm font-medium text-rose-600 dark:text-rose-400">
                {t('common.error')}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 break-words">
                {error}
              </div>
              <button onClick={fetchFiles} className="btn-secondary mt-4">
                <RefreshCw className="w-3.5 h-3.5" />
                {t('common.retry')}
              </button>
            </div>
          ) : files.length === 0 ? (
            <div className="min-h-48 flex flex-col items-center justify-center text-center px-8">
              <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Upload className="w-5 h-5 text-slate-400" />
              </div>
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                {t('files.empty')}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {files.map((file) => {
                const isLoading = loadingId === file.id;
                const isDeleting = deletingId === file.id;
                const actionPending = Boolean(loadingId || deletingId);
                return (
                  <div
                    key={file.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center shrink-0">
                        <FileSpreadsheet className="w-4 h-4 text-brand-600 dark:text-brand-300" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate" title={file.filename}>
                          {file.filename}
                        </div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {file.row_count ?? '—'} {t('files.rows')} · {file.col_count ?? '—'} {t('files.cols')}
                        </div>
                        <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
                          <Calendar className="w-3 h-3" />
                          {t('files.uploaded_at')} {formatDate(file.created_at)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        onClick={() => handleDelete(file.id)}
                        disabled={actionPending}
                        className="btn-ghost !text-xs text-rose-600 dark:text-rose-400 hover:!bg-rose-50 dark:hover:!bg-rose-900/20"
                      >
                        {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        {t('files.delete')}
                      </button>
                      <button
                        onClick={() => handleLoad(file.id)}
                        disabled={actionPending}
                        className="btn-primary !py-1.5 !px-3 !text-xs"
                      >
                        {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        {t('files.load')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
