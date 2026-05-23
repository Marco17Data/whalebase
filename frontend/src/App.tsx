import { useEffect, useState, useCallback } from 'react';
import type { TableInfo, AnswerResponse } from './types';
import { api } from './api';
import { TopBar } from './components/TopBar';
import { DataPanel } from './components/DataPanel';
import { DashboardView } from './components/DashboardView';
import { PivotView } from './components/PivotView';
import { WelcomeScreen } from './components/WelcomeScreen';
import { QueryCard } from './components/QueryCard';
import { HistoryPanel } from './components/HistoryPanel';
import { SQLPlayground } from './components/SQLPlayground';
import { SettingsDialog } from './components/SettingsDialog';
import { AIModal } from './components/AIModal';
import { CurrencyDialog } from './components/CurrencyDialog';
import { useI18n } from './i18n';

type MainView = 'welcome' | 'dashboard' | 'pivot' | 'query';

function App() {
  const { t, lang } = useI18n();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [activeTable, setActiveTable] = useState<string | null>(null);
  const [queries, setQueries] = useState<AnswerResponse[]>([]);
  const [view, setView] = useState<MainView>('welcome');
  const [currency, setCurrencyState] = useState<string>('none');

  const [historyOpen, setHistoryOpen] = useState(false);
  const [sqlOpen, setSqlOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aiOpen, setAIOpen] = useState(false);
  const [currencyDialogOpen, setCurrencyDialogOpen] = useState(false);
  const [suggestedCurrency, setSuggestedCurrency] = useState<string>('USD');
  const [isSample, setIsSample] = useState<boolean>(false);
  const [sampleId, setSampleId] = useState<string | null>(null);

  useEffect(() => {
    // Create session, load default sample, then expose sessionId to UI
    // so the user sees a real dashboard immediately (no empty welcome page).
    (async () => {
      const r = await api.createSession();
      try {
        await api.loadSample(r.session_id, 'sales');
      } catch (e) {
        // If sample loading fails (e.g. cold backend), session still works
        console.warn('Sample auto-load failed:', e);
      }
      // Set sessionId LAST so the refresh-tables effect runs after sample is loaded
      setSessionId(r.session_id);
    })();
  }, []);

  // 切语言时,如果有已生成的查询,把它们的 insight 用新语言重新生成
  useEffect(() => {
    if (!sessionId || queries.length === 0) return;
    api.retranslate(sessionId, queries, lang)
      .then((r) => setQueries(r.queries))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const refreshTables = useCallback(async () => {
    if (!sessionId) return;
    const info = await api.listTables(sessionId);
    setTables(info.tables);
    setCurrencyState(info.currency || 'none');
    setIsSample(info.is_sample || false);
    setSampleId(info.sample_id || null);
    // 默认选第一张表(如果还没选过/已选的表被删了)
    setActiveTable((prev) => {
      if (info.tables.length === 0) return null;
      if (prev && info.tables.some((t) => t.name === prev)) return prev;
      return info.tables[0].name;
    });
    if (info.tables.length > 0 && view === 'welcome') {
      setView('dashboard');
    }
    if (info.tables.length === 0) {
      setView('welcome');
      setQueries([]);
    }
  }, [sessionId, view]);

  // Once session is created, refresh tables -- sample data will appear here
  useEffect(() => {
    if (sessionId) {
      refreshTables();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // 上传成功回调:立即设 USD 为默认货币(这样数字立刻有 $ 符号),
  // 然后弹货币对话框给用户修改成自己想要的(如 CNY/EUR)
  const handleAfterUpload = async (suggested: string | undefined) => {
    if (!sessionId) return;
    refreshTables();
    if (currency === 'none') {
      const defaultCur = suggested && suggested !== 'none' ? suggested : 'USD';
      // 立即设默认值,数字立刻有 $ 符号
      await api.setCurrency(sessionId, defaultCur);
      setCurrencyState(defaultCur);
      setSuggestedCurrency(defaultCur);
      setCurrencyDialogOpen(true);
    }
  };

  const handleCurrencyConfirm = async (c: string) => {
    if (!sessionId) return;
    await api.setCurrency(sessionId, c);
    setCurrencyState(c);
  };

  const addQuery = (a: AnswerResponse) => {
    setQueries((q) => [a, ...q]);
    setView('query');
  };

  const exportMarkdown = async () => {
    if (!sessionId || queries.length === 0) return;
    const md = await api.exportMarkdown(sessionId, queries.map((q) => q.id), lang);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `whalebase-report-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalRows = tables.reduce((s, tb) => s + tb.row_count, 0);
  const hasData = tables.length > 0;

  if (!sessionId) {
    return (
      <div className="h-screen flex items-center justify-center text-sm text-slate-400">
        {t('common.loading')}
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      <TopBar
        queryCount={queries.length}
        tableCount={tables.length}
        totalRows={totalRows}
        currency={currency}
        onToggleSQL={() => setSqlOpen(!sqlOpen)}
        onToggleHistory={() => setHistoryOpen(!historyOpen)}
        onExport={exportMarkdown}
        onSettings={() => setSettingsOpen(true)}
        onAskAI={() => setAIOpen(true)}
        onChangeCurrency={() => {
          setSuggestedCurrency(currency !== 'none' ? currency : 'USD');
          setCurrencyDialogOpen(true);
        }}
        sqlOpen={sqlOpen}
        historyOpen={historyOpen}
      />

      <div className="flex flex-1 overflow-hidden">
        <DataPanel
          sessionId={sessionId}
          tables={tables}
          activeTable={activeTable}
          onTablesChanged={handleAfterUpload}
          onSelectTable={(name) => { setActiveTable(name); setView('dashboard'); }}
        />

        <main className="flex-1 overflow-y-auto">
          {!hasData && view === 'welcome' && (
            <WelcomeScreen onUploadClick={() => {
              const input = document.querySelector<HTMLInputElement>('input[type="file"]');
              input?.click();
            }} />
          )}

          {hasData && view === 'dashboard' && (
            <DashboardView
              sessionId={sessionId}
              currency={currency}
              activeTable={activeTable}
              onQueryGenerated={addQuery}
              onOpenPivot={() => setView('pivot')}
            />
          )}

          {hasData && view === 'pivot' && (
            <PivotView
              sessionId={sessionId}
              tables={tables}
              currency={currency}
              onClose={() => setView('dashboard')}
            />
          )}

          {hasData && view === 'query' && (
            <div className="max-w-5xl mx-auto px-6 py-6 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between mb-2">
                <button onClick={() => setView('dashboard')} className="btn-ghost">
                  ← {t('dashboard.back')}
                </button>
              </div>
              {queries.map((q, i) => (
                <QueryCard
                  key={q.id}
                  answer={q}
                  sessionId={sessionId}
                  currency={currency}
                  index={i}
                />
              ))}
            </div>
          )}
        </main>

        {historyOpen && (
          <HistoryPanel
            sessionId={sessionId}
            history={queries}
            onClose={() => setHistoryOpen(false)}
            onSelect={() => { setView('query'); setHistoryOpen(false); }}
          />
        )}
      </div>

      {sqlOpen && (
        <SQLPlayground
          sessionId={sessionId}
          tables={tables}
          onClose={() => setSqlOpen(false)}
        />
      )}

      {settingsOpen && (
        <SettingsDialog
          currency={currency}
          onClose={() => setSettingsOpen(false)}
          onChangeCurrency={() => {
            setSettingsOpen(false);
            setSuggestedCurrency(currency !== 'none' ? currency : 'USD');
            setCurrencyDialogOpen(true);
          }}
        />
      )}

      {aiOpen && (
        <AIModal
          sessionId={sessionId}
          onClose={() => setAIOpen(false)}
          onAnswer={addQuery}
        />
      )}

      {currencyDialogOpen && (
        <CurrencyDialog
          defaultCurrency={suggestedCurrency}
          onClose={() => setCurrencyDialogOpen(false)}
          onConfirm={handleCurrencyConfirm}
        />
      )}
    </div>
  );
}

export default App;
