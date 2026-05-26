import { useState } from 'react';
import { X, Mail, Loader2 } from 'lucide-react';
import { useI18n } from '../i18n';
import { useAuth } from '../AuthContext';

interface Props {
  onClose: () => void;
}

export function AuthDialog({ onClose }: Props) {
  const { t } = useI18n();
  const { signInWithMagicLink, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setError(null);
    const r = await signInWithMagicLink(email.trim());
    setSubmitting(false);
    if (r.ok) {
      setMagicSent(true);
    } else {
      setError(r.error || 'Failed');
    }
  }

  async function handleGoogle() {
    setSubmitting(true);
    setError(null);
    const r = await signInWithGoogle();
    if (!r.ok) {
      setSubmitting(false);
      setError(r.error || 'Failed');
    }
    // 成功时浏览器会跳转到 Google, 不需要 setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
            {t('auth.dialog_title')}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="px-6 py-5">
          {magicSent ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <Mail className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">
                {t('auth.magic_sent_title')}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {t('auth.magic_sent_desc')} <span className="font-mono">{email}</span>
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-3">
                {t('auth.magic_sent_hint')}
              </p>
            </div>
          ) : (
            <>
              {/* Google */}
              <button
                onClick={handleGoogle}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200 disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                {t('auth.continue_google')}
              </button>

              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                <span className="text-xs text-slate-400 uppercase">{t('auth.or')}</span>
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
              </div>

              {/* Magic Link */}
              <form onSubmit={handleMagicLink}>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                  {t('auth.email_label')}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  type="submit"
                  disabled={submitting || !email.trim()}
                  className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {submitting ? t('auth.sending') : t('auth.send_magic')}
                </button>
              </form>

              <p className="text-xs text-slate-500 dark:text-slate-500 mt-4 text-center">
                {t('auth.privacy_hint')}
              </p>
            </>
          )}

          {error && (
            <div className="mt-3 text-sm text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 rounded p-2">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
