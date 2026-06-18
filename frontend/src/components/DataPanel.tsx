import { useRef, useState } from 'react';
import {
  Upload, Database, Trash2, ChevronDown, ChevronRight, FileText, Loader2, GitCompare,
  ListChecks, X, AlertTriangle,
} from 'lucide-react';
import type { TableInfo } from '../types';
import { api } from '../api';
import { useI18n } from '../i18n';
import { CompareSelectDialog } from './CompareSelectDialog';

interface Props {
  sessionId: string;
  tables: TableInfo[];
  activeTable: string | null;
  onTablesChanged: (suggestedCurrency?: string) => void;
  onSelectTable: (name: string) => void;
}

export function DataPanel({ sessionId, tables, activeTable, onTablesChanged, onSelectTable }: Props) {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCompareDialog, setShowCompareDialog] = useState(false);
  const [manageMode, setManageMode] = useState(false);
  const [selectedTables, setSelectedTables] = useState<Set<string>>(() => new Set());
  const [confirmAction, setConfirmAction] = useState<'selected' | 'all' | null>(null);
  const [deleting, setDeleting] = useState(false);

  const visibleTables = tables.filter((tbl) => !tbl.name.startsWith('__'));
  const savedTables = visibleTables.filter((tbl) => Boolean(tbl.file_id));
  const selectedSavedTables = savedTables.filter((tbl) => selectedTables.has(tbl.name));

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const MAX_MB = 50;
    const oversized = Array.from(files).filter(f => f.size > MAX_MB * 1024 * 1024);
    if (oversized.length > 0) {
      const msgs = oversized.map(f =>
        `${f.name} (${(f.size / 1024 / 1024).toFixed(1)} MB)`
      ).join(', ');
      setError(`File too large: ${msgs}. Max ${MAX_MB} MB per file. Tip: open in Excel, keep recent rows, save as a smaller CSV.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const result = await api.uploadFiles(sessionId, Array.from(files));
      if (result.errors.length > 0) {
        setError(result.errors.map((e) => `${e.filename}: ${e.error}`).join('\n'));
      }
      onTablesChanged(result.suggested_currency);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (table: TableInfo) => {
    if (table.file_id) {
      setSelectedTables(new Set([table.name]));
      setConfirmAction('selected');
      return;
    }
    if (!confirm(t('data.delete_confirm', { name: table.name }))) return;
    try {
      await api.deleteTable(sessionId, table.name);
      onTablesChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const exitManageMode = () => {
    setManageMode(false);
    setSelectedTables(new Set());
    setConfirmAction(null);
  };

  const toggleTableSelected = (table: TableInfo) => {
    if (!table.file_id) return;
    setSelectedTables((prev) => {
      const next = new Set(prev);
      if (next.has(table.name)) next.delete(table.name);
      else next.add(table.name);
      return next;
    });
  };

  const confirmPermanentDelete = async () => {
    const targets = confirmAction === 'all' ? savedTables : selectedSavedTables;
    if (targets.length === 0) {
      setConfirmAction(null);
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      for (const table of targets) {
        if (!table.file_id) continue;
        await api.deleteMyFile(table.file_id);
        try {
          await api.deleteTable(sessionId, table.name);
        } catch (e) {
          console.warn('Workspace table removal after permanent delete failed:', table.name, e);
        }
      }
      exitManageMode();
      onTablesChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <aside className="w-64 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex flex-col h-full shrink-0">
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <h2 className="label">{t('data.title')}</h2>
          </div>
          {visibleTables.length > 0 && (
            <button
              onClick={() => {
                if (manageMode) exitManageMode();
                else setManageMode(true);
              }}
              disabled={!manageMode && savedTables.length === 0}
              className={`p-1 rounded-md transition-colors ${
                manageMode
                  ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                  : 'text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed'
              }`}
              title={manageMode ? t('data.done') : savedTables.length > 0 ? t('data.manage') : t('data.no_saved_files')}
            >
              {manageMode ? <X className="w-3.5 h-3.5" /> : <ListChecks className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* 上传区 */}
      <div className="p-3">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!uploading) handleUpload(e.dataTransfer.files);
          }}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`border border-dashed rounded-md p-4 text-center transition-colors
            ${uploading
              ? 'border-brand-300 dark:border-brand-700 bg-brand-50/50 dark:bg-brand-900/20 cursor-wait'
              : 'border-slate-300 dark:border-slate-600 hover:border-brand-500 dark:hover:border-brand-500 hover:bg-brand-50/30 dark:hover:bg-brand-900/20 cursor-pointer'}`}
        >
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 mx-auto mb-2 text-brand-600 dark:text-brand-400 animate-spin" />
              <p className="text-xs text-brand-700 dark:text-brand-300">{t('data.parsing')}</p>
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mx-auto mb-2 text-slate-400 dark:text-slate-500" />
              <p className="text-xs text-slate-600 dark:text-slate-300 mb-0.5">{t('data.upload')}</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">{t('data.formats')}</p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".csv,.tsv,.xlsx,.xls,.json"
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
        </div>
        {error && (
          <div className="mt-2 text-[11px] text-danger dark:text-rose-300 bg-red-50 dark:bg-rose-900/30 px-2 py-1.5 rounded-md whitespace-pre-wrap leading-relaxed">
            {error}
          </div>
        )}
      </div>

      {/* 表列表 */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {visibleTables.length === 0 ? (
          <div className="text-center py-6 text-[11px] text-slate-400 dark:text-slate-500">
            {t('data.empty')}
          </div>
        ) : (
          <div className="space-y-1">
            {visibleTables.map((tbl) => (
              <TableItem
                key={tbl.name}
                table={tbl}
                expanded={expandedTable === tbl.name}
                isActive={activeTable === tbl.name}
                manageMode={manageMode}
                selected={selectedTables.has(tbl.name)}
                selectable={Boolean(tbl.file_id)}
                onExpandToggle={() => setExpandedTable(expandedTable === tbl.name ? null : tbl.name)}
                onSelect={() => onSelectTable(tbl.name)}
                onToggleSelect={() => toggleTableSelected(tbl)}
                onDelete={() => handleDelete(tbl)}
              />
            ))}
          </div>
        )}
      </div>

      {visibleTables.length > 0 && (
        <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
          {manageMode ? (
            <>
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>{t('data.selected_count', { count: selectedSavedTables.length })}</span>
                <button
                  onClick={exitManageMode}
                  className="font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
                >
                  {t('data.done')}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => setConfirmAction('selected')}
                  disabled={selectedSavedTables.length === 0 || deleting}
                  className="px-2 py-1.5 rounded-md text-[11px] font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/25 hover:bg-rose-100 dark:hover:bg-rose-900/40 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('data.delete_selected')}
                </button>
                <button
                  onClick={() => setConfirmAction('all')}
                  disabled={savedTables.length === 0 || deleting}
                  className="px-2 py-1.5 rounded-md text-[11px] font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/25 hover:bg-rose-100 dark:hover:bg-rose-900/40 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('data.clear_all')}
                </button>
              </div>
            </>
          ) : (
            (() => {
              const canCompare = visibleTables.length >= 2;
              return (
              <button
                onClick={() => canCompare && setShowCompareDialog(true)}
                disabled={!canCompare}
                title={canCompare ? '' : t('compare.btn_disabled_tooltip')}
                className={`btn-ghost w-full ${!canCompare ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <GitCompare className="w-3 h-3" />
                {t('compare.btn_tooltip')}
              </button>
              );
            })()
          )}
        </div>
      )}
    </aside>
      {confirmAction && (
        <PermanentDeleteDialog
          mode={confirmAction}
          count={confirmAction === 'all' ? savedTables.length : selectedSavedTables.length}
          deleting={deleting}
          onCancel={() => !deleting && setConfirmAction(null)}
          onConfirm={confirmPermanentDelete}
        />
      )}
      {showCompareDialog && (
        <CompareSelectDialog
          sessionId={sessionId}
          tables={tables}
          onClose={() => setShowCompareDialog(false)}
          onApplied={() => { setShowCompareDialog(false); onTablesChanged(); }}
        />
      )}
    </>
  );
}

function TableItem({
  table,
  expanded,
  isActive,
  manageMode,
  selected,
  selectable,
  onExpandToggle,
  onSelect,
  onToggleSelect,
  onDelete,
}: {
  table: TableInfo;
  expanded: boolean;
  isActive: boolean;
  manageMode: boolean;
  selected: boolean;
  selectable: boolean;
  onExpandToggle: () => void;
  onSelect: () => void;
  onToggleSelect: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className={`rounded-md border transition-colors
      ${isActive
        ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-900/30 ring-1 ring-brand-200 dark:ring-brand-800'
        : 'border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600 bg-slate-50/40 dark:bg-slate-800/40'}`}>
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        {manageMode ? (
          <input
            type="checkbox"
            checked={selected}
            disabled={!selectable}
            onChange={(e) => {
              e.stopPropagation();
              onToggleSelect();
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-3 h-3 rounded border-slate-300 text-brand-600 focus:ring-brand-500 disabled:opacity-30"
            title={selectable ? '' : t('data.no_saved_files')}
          />
        ) : (
          <button
            onClick={onExpandToggle}
            className="p-0.5 -ml-0.5 rounded hover:bg-slate-200/60 dark:hover:bg-slate-700/60"
            title="Show columns"
          >
            {expanded ? (
              <ChevronDown className="w-3 h-3 text-slate-400 dark:text-slate-500" />
            ) : (
              <ChevronRight className="w-3 h-3 text-slate-400 dark:text-slate-500" />
            )}
          </button>
        )}
        <div
          onClick={manageMode ? onToggleSelect : onSelect}
          className={`flex items-center gap-1.5 flex-1 min-w-0 ${
            manageMode
              ? selectable ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
              : 'cursor-pointer'
          }`}
          title="Click to analyze this table"
        >
          <FileText className={`w-3 h-3 shrink-0 ${isActive ? 'text-brand-900 dark:text-brand-300' : 'text-brand-700 dark:text-brand-400'}`} />
          <div className="flex-1 min-w-0">
            <div className={`text-xs font-medium truncate ${isActive ? 'text-brand-900 dark:text-brand-200' : 'text-slate-800 dark:text-slate-200'}`}>
              {table.name}
              {isActive && <span className="ml-1 text-[9px] text-accent-700 dark:text-accent-300 font-mono">●</span>}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">
              {table.row_count.toLocaleString()} {t('data.rows')} · {table.columns.length} {t('data.cols')}
            </div>
          </div>
        </div>
        {!manageMode && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-0.5 rounded hover:bg-red-50 dark:hover:bg-rose-900/30 text-slate-400 dark:text-slate-500 hover:text-danger dark:hover:text-rose-400 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>

      {expanded && !manageMode && (
        <div className="border-t border-slate-100 dark:border-slate-700 px-2 py-1.5 space-y-1 max-h-60 overflow-y-auto">
          {table.columns.map((col) => (
            <div key={col.name} className="text-[11px] flex items-baseline gap-1.5">
              <span className="font-mono text-slate-700 dark:text-slate-200 truncate flex-1">{col.name}</span>
              <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono uppercase shrink-0">
                {dtypeShort(col.dtype)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PermanentDeleteDialog({
  mode,
  count,
  deleting,
  onCancel,
  onConfirm,
}: {
  mode: 'selected' | 'all';
  count: number;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useI18n();
  const title = mode === 'all' ? t('data.clear_all_title') : t('data.delete_selected_title');
  const body = mode === 'all'
    ? t('data.clear_all_body')
    : t(count === 1 ? 'data.delete_selected_body_one' : 'data.delete_selected_body', { count });
  const confirmLabel = mode === 'all' ? t('data.clear_all_permanently') : t('data.delete_permanently');

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-700 p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-300" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {body}
            </p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="btn-secondary"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting || count === 0}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function dtypeShort(t: string): string {
  return ({
    integer: 'int',
    float: 'num',
    text: 'str',
    datetime: 'date',
    boolean: 'bool',
  } as Record<string, string>)[t] || t;
}
