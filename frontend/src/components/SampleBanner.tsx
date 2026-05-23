import { useState } from 'react';
import { Info, ChevronDown, Upload } from 'lucide-react';
import { useI18n } from '../i18n';

interface Props {
  sampleId: string | null;
  onSwitchSample: (sampleId: string) => void;
  onUploadClick: () => void;
}

const SAMPLES = [
  { id: 'sales', label: 'Sales (mixed regions)', rows: 5455 },
  { id: 'coffee', label: 'Coffee shop chain', rows: 3000 },
  { id: 'ecommerce', label: 'E-commerce orders', rows: 2500 },
  { id: 'restaurant', label: 'Restaurant orders', rows: 1200 },
];

export function SampleBanner({ sampleId, onSwitchSample, onUploadClick }: Props) {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 flex items-center justify-between text-sm">
      <div className="flex items-center gap-2 text-blue-900">
        <Info className="w-4 h-4 flex-shrink-0" />
        <span>
          <span className="font-medium">{t('sample.banner.title')}</span>
          <span className="text-blue-700/80 ml-1.5">{t('sample.banner.desc')}</span>
        </span>
      </div>

      <div className="flex items-center gap-2 relative">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-blue-900 bg-white/60 hover:bg-white border border-blue-200 rounded-md transition"
        >
          {t('sample.banner.try_another')}
          <ChevronDown className="w-3 h-3" />
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-24 top-full mt-1 z-20 bg-white border border-slate-200 rounded-md shadow-lg overflow-hidden min-w[220px]">
              {SAMPLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setMenuOpen(false);
                    onSwitchSample(s.id);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-blue-50 flex items-center justify-between gap-2 ${
                    s.id === sampleId ? 'bg-blue-50/60' : ''
                  }`}
                >
                  <span className="text-slate-700">{s.label}</span>
                  <span className="text-slate-400">{s.rows.toLocaleString()} rows</span>
                </button>
              ))}
            </div>
          </>
        )}

        <button
          onClick={onUploadClick}
          className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-md transition"
        >
          <Upload className="w-3 h-3" />
          {t('sample.banner.upload_yours')}
        </button>
      </div>
    </div>
  );
}
