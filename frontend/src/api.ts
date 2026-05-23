import type {
  TableInfo, AnswerResponse, AutoInsight, QueryResult,
  DashboardCard, TemplateMeta, TemplateResult, PresetQuestion,
  PivotConfig, PivotResult,
} from './types';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, init);
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
