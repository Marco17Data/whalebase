import { useState } from 'react';
import { X, DollarSign } from 'lucide-react';
import { useI18n } from '../i18n';

interface Props {
  defaultCurrency: string;
  onClose: () => void;
  onConfirm: (currency: string) => void;
}

const CURRENCIES = [
  { code: 'USD', symbol: '$',  name: 'US Dollar' },
  { code: 'EUR', symbol: '€',  name: 'Euro' },
  { code: 'GBP', symbol: '£',  name: 'British Pound' },
  { code: 'CNY', symbol: '¥',  name: 'Chinese Yuan' },
  { code: 'JPY', symbol: '¥',  name: 'Japanese Yen' },
  { code: 'KRW', symbol: '₩',  name: 'Korean Won' },
  { code: 'INR', symbol: '₹',  name: 'Indian Rupee' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
];

export function CurrencyDialog({ defaultCurrency, onClose, onConfirm }: Props) {
  const { t } = useI18n();
  const [picked, setPicked] = useState(defaultCurrency);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center px-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent-100 flex items-center justify-center shrink-0">
              <DollarSign className="w-4 h-4 text-accent-700" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                {t('currency.title')}
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5 max-w-md">
                {t('currency.desc')}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost !p-1.5">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Grid */}
        <div className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-72 overflow-y-auto">
            {CURRENCIES.map((c) => (
              <button
                key={c.code}
                onClick={() => setPicked(c.code)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-left border transition-all
                  ${picked === c.code
                    ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-200'
                    : 'border-slate-200 hover:border-slate-300 bg-white'}`}
              >
                <span className={`text-lg font-semibold w-6 text-center
                  ${picked === c.code ? 'text-brand-900' : 'text-slate-700'}`}>
                  {c.symbol}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-mono font-semibold text-slate-900">{c.code}</div>
                  <div className="text-[10px] text-slate-500 truncate">{c.name}</div>
                </div>
              </button>
            ))}
          </div>

          {/* No currency option */}
          <button
            onClick={() => setPicked('none')}
            className={`mt-2 w-full flex items-center gap-2 px-3 py-2 rounded-md text-left border transition-all
              ${picked === 'none'
                ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-200'
                : 'border-slate-200 hover:border-slate-300 bg-white'}`}
          >
            <span className="w-6 text-center text-slate-400">—</span>
            <div className="text-xs font-medium text-slate-700">{t('currency.none')}</div>
          </button>

          <p className="text-[10px] text-slate-400 mt-3 text-center">
            {t('currency.change_later')}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-100 bg-slate-50/50">
          <button onClick={onClose} className="btn-ghost">
            {t('currency.skip')}
          </button>
          <button onClick={() => { onConfirm(picked); onClose(); }} className="btn-accent">
            {t('currency.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
