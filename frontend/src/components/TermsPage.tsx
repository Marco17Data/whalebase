import { useI18n } from '../i18n';

export function TermsPage() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4">
      <div className="max-w-2xl mx-auto bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-8">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-3">
          {t('legal.terms_title')}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          {t('legal.coming_soon')}
        </p>
        <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
          {t('legal.contact_us')}{' '}
          <a href="mailto:marcozhao17@gmail.com" className="underline text-brand-600 dark:text-brand-400">
            marcozhao17@gmail.com
          </a>
        </p>
        <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-800">
          <a href="/" className="text-sm text-slate-500 dark:text-slate-400 hover:underline">
            ← {t('legal.back_home')}
          </a>
        </div>
      </div>
    </div>
  );
}
