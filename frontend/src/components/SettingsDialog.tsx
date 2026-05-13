import { X, Sparkles, Shield, Database, DollarSign } from 'lucide-react';
import { useI18n } from '../i18n';

interface Props {
  currency: string;
  onClose: () => void;
  onChangeCurrency: () => void;
}

export function SettingsDialog({ currency, onClose, onChangeCurrency }: Props) {
  const { t } = useI18n();

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center px-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900">{t('nav.settings')}</h2>
          <button onClick={onClose} className="btn-ghost !p-1.5">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <Section
            icon={<Sparkles className="w-3.5 h-3.5 text-accent-500" />}
            title="LLM Provider"
            value="Gemini 2.5 Flash"
            sub="Free tier · 15 req/min"
          />

          <Section
            icon={<Database className="w-3.5 h-3.5 text-brand-700" />}
            title="Engine"
            value="DuckDB (in-memory)"
            sub="SELECT/WITH/SHOW/DESCRIBE only"
          />

          {/* 货币设置 */}
          <button
            onClick={onChangeCurrency}
            className="w-full flex items-start gap-2.5 text-left hover:bg-slate-50 -mx-2 px-2 py-1 rounded-md transition-colors"
          >
            <div className="w-7 h-7 rounded-md bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
              <DollarSign className="w-3.5 h-3.5 text-accent-700" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-slate-400">
                {t('currency.title')}
              </div>
              <div className="text-sm text-slate-900 font-mono font-semibold mt-0.5">
                {currency === 'none' ? t('currency.none') : currency}
              </div>
            </div>
            <div className="text-[10px] text-brand-600 mt-1">{t('common.confirm')} →</div>
          </button>

          <Section
            icon={<Shield className="w-3.5 h-3.5 text-success" />}
            title={t('features.privacy.title')}
            value={t('features.privacy.desc')}
          />

          <div className="text-[11px] text-slate-400 leading-relaxed pt-2 border-t border-slate-100">
            To change provider or model, edit{' '}
            <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">backend/.env</code>{' '}
            and restart.
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  icon, title, value, sub,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="w-7 h-7 rounded-md bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-slate-400">{title}</div>
        <div className="text-sm text-slate-900 font-medium mt-0.5">{value}</div>
        {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}
