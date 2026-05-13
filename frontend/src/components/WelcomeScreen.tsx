import { Upload, LayoutGrid, MousePointerClick, ArrowRight } from 'lucide-react';
import { useI18n } from '../i18n';
import { Logo } from './Logo';

interface Props {
  onUploadClick: () => void;
}

export function WelcomeScreen({ onUploadClick }: Props) {
  const { t } = useI18n();

  return (
    <div className="max-w-4xl mx-auto px-8 py-10 animate-fade-in">
      <div className="mb-8 flex items-center gap-4">
        <Logo size={48} />
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
            {t('welcome.title')}
          </h1>
          <p className="text-sm text-slate-600 mt-1">{t('welcome.subtitle')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
        <StepCard
          number={1}
          icon={<Upload className="w-4 h-4" />}
          title={t('welcome.step1.title')}
          desc={t('welcome.step1.desc')}
          active
          onClick={onUploadClick}
        />
        <StepCard
          number={2}
          icon={<LayoutGrid className="w-4 h-4" />}
          title={t('welcome.step2.title')}
          desc={t('welcome.step2.desc')}
        />
        <StepCard
          number={3}
          icon={<MousePointerClick className="w-4 h-4" />}
          title={t('welcome.step3.title')}
          desc={t('welcome.step3.desc')}
        />
      </div>

      <div className="card-shadow bg-gradient-to-br from-brand-900 to-brand-950 text-white p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent-500/10 rounded-full blur-3xl -mr-32 -mt-32" />
        <div className="relative">
          <h2 className="text-2xl font-semibold mb-2 tracking-tight">
            {t('welcome.cta')}
          </h2>
          <p className="text-brand-100 text-sm mb-5 max-w-md leading-relaxed">
            {t('welcome.cta_sub')}
          </p>
          <button
            onClick={onUploadClick}
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white rounded-md font-medium text-sm transition-colors shadow-lg shadow-accent-500/30"
          >
            <Upload className="w-4 h-4" />
            {t('welcome.cta')}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function StepCard({
  number,
  icon,
  title,
  desc,
  active = false,
  onClick,
}: {
  number: number;
  icon: React.ReactNode;
  title: string;
  desc: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`card p-4 transition-all ${
        active
          ? 'border-brand-300 cursor-pointer hover:border-brand-500 hover:shadow-md'
          : ''
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span
          className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${
            active ? 'bg-brand-100 text-brand-900' : 'bg-slate-100 text-slate-500'
          }`}
        >
          0{number}
        </span>
        <span
          className={`w-7 h-7 rounded-md flex items-center justify-center ${
            active ? 'bg-brand-900 text-white' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {icon}
        </span>
      </div>
      <h3 className="text-sm font-semibold text-slate-900 mb-1">{title}</h3>
      <p className="text-xs text-slate-600 leading-relaxed">{desc}</p>
    </div>
  );
}
