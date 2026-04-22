import { MinusIcon, PlusIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';
import { T } from './tokens';

interface NumberStepperProps {
  active: boolean;
  onActivate: () => void;
  value: string;
  onChange: (v: string) => void;
  min?: number;
  step?: number;
  prompt?: string;
  previewTitle?: string;
  previewSubtitle?: string;
  inputWidth?: string;
}

/**
 * Dashed prompt block that expands into an active stepper with live preview.
 * Gebruikt voor custom-aantal (leads/afspraken) en custom-snelheid.
 */
export function NumberStepper({
  active,
  onActivate,
  value,
  onChange,
  min = 1,
  step = 1,
  prompt = 'Ander aantal kiezen...',
  previewTitle,
  previewSubtitle,
  inputWidth = 'w-20',
}: NumberStepperProps) {
  const parsed = parseInt(value) || 0;

  return (
    <div className={`w-full rounded-2xl border-2 p-3 text-left transition ${active ? T.tileActive : T.tileDashed}`.trim()}>
      {!active ? (
        <button
          type="button"
          onClick={onActivate}
          className="flex min-h-11 w-full items-center justify-center rounded-xl text-sm font-medium text-slate-500 transition hover:bg-slate-50"
        >
          {prompt}
        </button>
      ) : (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onChange(String(Math.max(min, parsed - step)))}
              className={T.btnIconSquare}
              aria-label="Verminderen"
            >
              <MinusIcon className="h-4 w-4" />
            </button>
            <input
              type="number"
              min={min}
              value={value}
              onChange={e => onChange(e.target.value)}
              className={`h-11 ${inputWidth} rounded-xl border border-slate-200 bg-white px-2 text-center text-sm font-bold text-slate-900 outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple/20`}
            />
            <button
              type="button"
              onClick={() => onChange(String(parsed + step))}
              className={T.btnIconSquare}
              aria-label="Verhogen"
            >
              <PlusIcon className="h-4 w-4" />
            </button>
          </div>
          {(previewTitle || previewSubtitle) && (
            <div className="flex-1">
              {previewTitle && <p className="text-sm font-semibold text-brand-purple">{previewTitle}</p>}
              {previewSubtitle && <p className="text-[11px] text-slate-400">{previewSubtitle}</p>}
            </div>
          )}
          <CheckCircleSolid className="h-5 w-5 shrink-0 text-brand-purple" />
        </div>
      )}
    </div>
  );
}
