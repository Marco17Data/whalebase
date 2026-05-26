import { useState, useRef, useEffect } from 'react';
import { LogOut, User as UserIcon } from 'lucide-react';
import { useI18n } from '../i18n';
import { useAuth } from '../AuthContext';

export function UserMenu() {
  const { t } = useI18n();
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (!user) return null;

  const initial = (user.email || user.user_metadata?.full_name || '?')[0].toUpperCase();
  const avatarUrl = user.user_metadata?.avatar_url as string | undefined;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-2 py-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="w-7 h-7 rounded-full" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-brand-500 text-white flex items-center justify-center text-sm font-semibold">
            {initial}
          </div>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
            <div className="text-xs text-slate-500 dark:text-slate-400">{t('auth.signed_in_as')}</div>
            <div className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
              {user.email}
            </div>
          </div>
          <button
            onClick={async () => { setOpen(false); await signOut(); }}
            className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            {t('auth.sign_out')}
          </button>
        </div>
      )}
    </div>
  );
}
