import type {
  TableInfo, AnswerResponse, AutoInsight, QueryResult,
  DashboardCard, TemplateMeta, TemplateResult, PresetQuestion,
  PivotConfig, PivotResult,
} from './types';
import { supabase } from './supabase';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

async function authHeaders(): Promise<Record<string, string>> {
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) {
      return { Authorization: `Bearer ${data.session.access_token}` };
    }
  } catch {
    // ignore
  }
  return {};
}

async function fetchWithAuth(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const auth = await authHeaders();
  const headers = { ...(init?.headers || {}), ...auth };
  return fetch(input, { ...init, headers });
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetchWithAuth(`${API_BASE}${path}`, init);
  if (!resp.ok) {
    let errMsg = `Request failed (${resp.status})`;
    try {
      const data = await resp.json();
      errMsg = data.detail || errMsg;
    } catch { /* ignore */ }
    throw new Error(errMsg);
  }
  const ct = resp.headers.get('content-type') || '';
  if (ct.includes('application/json')) return resp.json() as Promise<T>;
  return resp.text() as unknown as Promise<T>;
}

export const api = {
  createSession: () =>
    request<{ session_id: string }>('/session', { method: 'POST' }),

  deleteSession: (sid: string) =>
    request<{ ok: boolean }>(`/session/${sid}`, { method: 'DELETE' }),

  uploadFiles: async (sid: string, files: File[]) => {
    const fd = new FormData();
    for (const f of files) fd.append('files', f);
    return request<{
      tables: TableInfo[];
      errors: { filename: string; error: string }[];
      suggested_currency?: string;
    }>(`/session/${sid}/upload`, { method: 'POST', body: fd });
  },

  listTables: (sid: string) =>
    request<{
      tables: TableInfo[];
      currency: string;
      is_sample?: boolean;
      sample_id?: string | null;
    }>(`/session/${sid}/tables`),

  // ===== Samples =====
  listSamples: () =>
    request<{
      samples: Array<{
        id: string;
        label_en: string;
        label_zh: string;
        rows: number;
        cols: number;
        currency: string;
      }>;
    }>('/samples'),

  loadSample: (sid: string, sampleId: string) =>
    request<{
      table: TableInfo;
      currency: string;
      sample_id: string;
    }>(`/session/${sid}/load-sample/${sampleId}`, { method: 'POST' }),

  // ===== Overview (hero view: KPIs + pie + trend) =====
  getDataQuality: (sid: string, lang: string = 'en', table?: string) => {
    const params = new URLSearchParams({ lang });
    if (table) params.set('table', table);
    return request<{
      row_count: number;
      col_count: number;
      duplicate_rows: number;
      duplicate_pct: number;
      columns_with_nulls: Array<{ name: string; null_count: number; null_pct: number }>;
    }>(`/session/${sid}/data-quality?${params}`);
  },

  // ===== Cleanup (Stage 3 Step 2) =====
  getCleanupSuggestions: (sid: string, lang: string = 'en', table?: string) => {
    const params = new URLSearchParams({ lang });
    if (table) params.set('table', table);
    return request<{
      table: string | null;
      row_count: number;
      suggestions: Array<{
        id: string;
        type: 'duplicates' | 'nulls';
        count: number;
        column?: string;
        fill_strategy?: 'zero' | 'placeholder';
        fill_value_numeric?: number | null;
        after_rows?: number;
      }>;
    }>(`/session/${sid}/cleanup/suggestions?${params}`);
  },

  applyCleanup: (sid: string, selectedIds: string[], lang: string = 'en', table?: string) => {
    const params = new URLSearchParams();
    if (table) params.set('table', table);
    const qs = params.toString();
    return request<{
      ok: boolean;
      table?: string;
      actions?: string[];
      new_row_count?: number;
      error?: string;
    }>(`/session/${sid}/cleanup/apply${qs ? `?${qs}` : ''}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selected_ids: selectedIds, lang }),
    });
  },

  undoCleanup: (sid: string, table?: string) => {
    const params = new URLSearchParams();
    if (table) params.set('table', table);
    const qs = params.toString();
    return request<{
      ok: boolean;
      table?: string;
      restored_rows?: number;
      error?: string;
    }>(`/session/${sid}/cleanup/undo${qs ? `?${qs}` : ''}`, { method: 'POST' });
  },

  getCleanupStatus: (sid: string, table?: string) => {
    const params = new URLSearchParams();
    if (table) params.set('table', table);
    const qs = params.toString();
    return request<{
      has_snapshot: boolean;
      table: string | null;
    }>(`/session/${sid}/cleanup/status${qs ? `?${qs}` : ''}`);
  },

  // ===== Compare (Stage 3 Step 3) =====
  detectComparable: (sid: string) =>
    request<{
      groups: Array<{
        tables: string[];
        match_pct: number;
        matched_columns: string[];
        matched_count: number;
      }>;
    }>(`/session/${sid}/compare/detect`),

  enableCompare: (sid: string, tables: string[]) =>
    request<{
      ok: boolean;
      merged_table?: string;
      source_tables?: string[];
      row_count?: number;
      error?: string;
    }>(`/session/${sid}/compare/enable`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tables }),
    }),

  disableCompare: (sid: string) =>
    request<{ ok: boolean; error?: string }>(`/session/${sid}/compare/disable`, { method: 'POST' }),

  getCompareStatus: (sid: string) =>
    request<{
      active: boolean;
      source_tables?: string[];
      merged_table?: string;
    }>(`/session/${sid}/compare/status`),

  getOverview: (sid: string, lang: string = 'en', table?: string) => {
    const params = new URLSearchParams({ lang });
    if (table) params.set('table', table);
    return request<{
      kpis: Array<{
        label: string;
        value: number | string;
        format: 'number' | 'currency' | 'date';
        sub?: number;
        sparkline?: number[];
        change_pct?: number | null;
        period_status?: 'complete' | 'partial' | 'single' | null;
      }>;
      pie: null | {
        title: string;
        dimension: string;
        total: number;
        is_currency: boolean;
        slices: Array<{ label: string; value: number; pct: number }>;
        high_concentration?: boolean;
        top_pct?: number;
        top3_pct?: number;
        top_label?: string;
      };
      trend: null | {
        title: string;
        is_currency: boolean;
        points: Array<{ month: string; value: number; is_anomaly?: boolean; anomaly_type?: 'spike' | 'drop' | null; deviation_pct?: number; mean_value?: number }>;
      };
      comparison?: null | {
        datasets: string[];
        kpi_by_dataset: {
          rows?: Record<string, number>;
          revenue?: Record<string, number>;
        };
        trend_by_dataset: Record<string, Array<{ month: string; value: number }>>;
        is_currency: boolean;
      };
    }>(`/session/${sid}/overview?${params}`);
  },

  deleteTable: (sid: string, tableName: string) =>
    request<{ ok: boolean }>(
      `/session/${sid}/table/${encodeURIComponent(tableName)}`,
      { method: 'DELETE' }
    ),

  // ===== Currency =====
  getCurrency: (sid: string) =>
    request<{ currency: string }>(`/session/${sid}/currency`),

  setCurrency: (sid: string, currency: string) =>
    request<{ currency: string }>(`/session/${sid}/currency`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currency }),
    }),

  // ===== Ask =====
  ask: (sid: string, question: string, lang: string = 'en', useHistory = true) =>
    request<AnswerResponse>(`/session/${sid}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, use_history: useHistory, lang }),
    }),

  runSQL: (sid: string, sql: string) =>
    request<{ sql: string; result: QueryResult }>(`/session/${sid}/sql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql }),
    }),

  getSuggestions: (sid: string, lang: string = 'en') =>
    request<{ questions: string[] }>(`/session/${sid}/suggestions?lang=${lang}`),

  getAutoInsights: (sid: string, lang: string = 'en') =>
    request<{ insights: AutoInsight[] }>(`/session/${sid}/auto-insights?lang=${lang}`),

  getDashboard: (sid: string, lang: string = 'en', table?: string) =>
    request<{ cards: DashboardCard[] }>(
      `/session/${sid}/dashboard?lang=${lang}${table ? `&table=${encodeURIComponent(table)}` : ''}`
    ),

  getHistory: (sid: string) =>
    request<{ history: AnswerResponse[] }>(`/session/${sid}/history`),

  exportMarkdown: (sid: string, queryIds: number[] | null = null, lang: string = 'en') =>
    request<string>(`/session/${sid}/export/markdown`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query_ids: queryIds, lang }),
    }),

  // ===== Templates =====
  listTemplates: (lang: string = 'en') =>
    request<{ templates: TemplateMeta[] }>(`/templates?lang=${lang}`),

  runTemplate: (sid: string, templateId: string, lang: string = 'en', table?: string) =>
    request<TemplateResult>(
      `/session/${sid}/template/${templateId}?lang=${lang}${table ? `&table=${encodeURIComponent(table)}` : ''}`,
      { method: 'POST' }
    ),

  // ===== Preset Questions =====
  getPresetQuestions: (sid: string, lang: string = 'en', table?: string) =>
    request<{ questions: PresetQuestion[] }>(
      `/session/${sid}/preset-questions?lang=${lang}${table ? `&table=${encodeURIComponent(table)}` : ''}`
    ),

  runPreset: (sid: string, presetId: string, lang: string = 'en', table?: string) =>
    request<AnswerResponse>(
      `/session/${sid}/preset/${presetId}?lang=${lang}${table ? `&table=${encodeURIComponent(table)}` : ''}`,
      { method: 'POST' }
    ),

  // ===== Retranslate (切语言时刷新已有查询) =====
  retranslate: (sid: string, queries: AnswerResponse[], lang: string) =>
    request<{ queries: AnswerResponse[] }>(`/session/${sid}/retranslate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queries, lang }),
    }),

  // ===== Pivot =====
  runPivot: (sid: string, config: PivotConfig) =>
    request<PivotResult>(`/session/${sid}/pivot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    }),
};
