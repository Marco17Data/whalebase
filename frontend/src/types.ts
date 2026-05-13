export interface ColumnInfo {
  name: string;
  dtype: 'integer' | 'float' | 'text' | 'datetime' | 'boolean';
  null_count: number;
  sample_values: any[];
  min_value: any;
  max_value: any;
  distinct_count: number | null;
}

export interface TableInfo {
  name: string;
  original_filename: string;
  row_count: number;
  columns: ColumnInfo[];
  preview_rows: Record<string, any>[];
}

export interface QueryResult {
  columns: string[];
  rows: any[][];
  row_count: number;
  truncated: boolean;
  currency_cols?: string[];
}

export type ChartType = 'line' | 'bar' | 'pie' | 'scatter' | 'area' | 'table' | 'kpi';

export interface AnswerResponse {
  id: number;
  question: string;
  sql: string;
  explanation: string;
  chart_hint: ChartType;
  result: QueryResult;
  insight: string;
}

export interface AutoInsight {
  title: string;
  content: string;
  suggested_question: string;
}

export interface DashboardCard {
  title: string;
  subtitle: string;
  chart_type: ChartType;
  sql: string;
  result: QueryResult;
}

export interface TemplateMeta {
  id: string;
  title: string;
  icon: string;
}

export interface TemplateResult {
  template_id: string;
  title: string;
  cards: DashboardCard[];
  warnings: string[];
}

export interface PresetQuestion {
  id: string;
  category: 'sales' | 'customer' | 'overview' | string;
  label: string;
  chart_hint: ChartType;
  sql: string;
  currency_col?: string;
}

export interface PivotConfig {
  table: string;
  rows: string[];
  columns: string[];
  measure: string | null;
  agg: 'sum' | 'avg' | 'count' | 'count_distinct' | 'min' | 'max';
  filters: Array<{ column: string; op: string; value: any }>;
  limit?: number;
}

export interface PivotResult {
  sql: string;
  result: QueryResult;
  config: PivotConfig;
}
