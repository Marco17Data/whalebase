/**
 * 货币 + 数字格式化工具
 */

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', CNY: '¥', JPY: '¥',
  KRW: '₩', INR: '₹', CAD: 'C$', AUD: 'A$', BRL: 'R$',
};

export function getCurrencySymbol(code: string | null | undefined): string {
  if (!code || code === 'none') return '';
  return CURRENCY_SYMBOLS[code.toUpperCase()] || '';
}

/**
 * 格式化数字。
 * - 货币列 → 加货币符号
 * - 大数字自动转 K/M/B(图表用)
 * - 表格里显示原样数字带分组
 */
export function formatValue(
  value: any,
  options: {
    currency?: string | null;
    isCurrencyCol?: boolean;
    compact?: boolean;
  } = {}
): string {
  if (value === null || value === undefined || value === '') return '—';
  const num = Number(value);
  if (!isFinite(num)) return String(value);

  const sym = options.isCurrencyCol ? getCurrencySymbol(options.currency) : '';

  if (options.compact) {
    return sym + compactNumber(num);
  }
  // 普通：千分位
  const fixed = Math.abs(num) >= 100 ? Math.round(num).toLocaleString()
              : num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return sym + fixed;
}

function compactNumber(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
  if (abs >= 1e6) return (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
  if (abs >= 1e3) return (n / 1e3).toFixed(2).replace(/\.?0+$/, '') + 'K';
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
