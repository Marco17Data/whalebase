import { useState, useRef, useEffect } from 'react';
import { X, Sparkles, Loader2, Send } from 'lucide-react';
import { api } from '../api';
import type { AnswerResponse } from '../types';
import { useI18n } from '../i18n';

interface Props {
  sessionId: string;
  onClose: () => void;
  onAnswer: (a: AnswerResponse) => void;
}

export function AIModal({ sessionId, onClose, onAnswer }: Props) {
  const { t, lang } = useI18n();
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    api.getSuggestions(sessionId, lang)
      .then((r: { questions: string[] }) => setSuggestions(r.questions || []))
      .catch(() => {});
  }, [sessionId, lang]);

  const handleEscape = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
  };

  const submit = async () => {
    if (!q.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const ans = await api.ask(sessionId, q.trim(), lang);
      onAnswer(ans);
      onClose();
    } catch (e) {
      const msg = (e as Error).message;
      // 友好提示限流
      if (msg.includes('rate') || msg.includes('429') || msg.includes('quota') || msg.includes('限流')) {
        setError(t('ai.rate_limit'));
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-start justify-center pt-20 px-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-900 to-brand-700 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-accent-300" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">{t('ai.modal.title')}</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">{t('ai.modal.subtitle')}</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost !p-1.5">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Input */}
        <div className="p-5">
          <textarea
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={handleEscape}
            placeholder={t('ai.placeholder')}
            rows={3}
            disabled={loading}
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-md
                       focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100
                       resize-none disabled:opacity-60 disabled:bg-slate-50"
          />

          <div className="flex items-center justify-between mt-3">
            <div className="text-[11px] text-slate-400">
              <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 font-mono text-[10px]">⌘</kbd>
              {' + '}
              <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 font-mono text-[10px]">Enter</kbd>
            </div>
            <button
              onClick={submit}
              disabled={!q.trim() || loading}
              className="btn-accent"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {t('ai.thinking')}
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  {t('ai.submit')}
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="mt-3 p-2.5 rounded-md bg-red-50 border border-red-200 text-xs text-red-900">
              {error}
            </div>
          )}
        </div>

        {/* Suggestions */}
        {suggestions.length > 0 && !loading && (
          <div className="border-t border-slate-100 px-5 py-3 bg-slate-50/50">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-2">
              Suggestions
            </div>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.slice(0, 6).map((s, i) => (
                <button
                  key={i}
                  onClick={() => setQ(s)}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-white border border-slate-200
                             hover:border-brand-300 hover:bg-brand-50/50 text-slate-700 hover:text-brand-900 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
