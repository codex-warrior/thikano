'use client';

import { useEffect, useRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { X } from 'lucide-react';
import { cx } from '@thikano/web-ui';

const inputCls = 'mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-3 text-[14.5px] font-normal text-ink-900 outline-none transition-colors focus:border-navy-500 disabled:bg-canvas';

export function Field({ label, hint, className, ...rest }: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={cx('block text-[13px] font-semibold text-ink-700', className)}>
      {label}
      <input {...rest} className={cx(inputCls, 'h-11')} />
      {hint ? <span className="mt-1 block text-[12px] font-normal text-ink-400">{hint}</span> : null}
    </label>
  );
}

/** Rupee input; submit with `rupeesToPaise(form.get(name))`. */
export function MoneyField({ label, hint, className, ...rest }: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={cx('block text-[13px] font-semibold text-ink-700', className)}>
      {label}
      <span className="relative mt-1.5 block">
        <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-ink-400">₹</span>
        <input inputMode="numeric" pattern="[0-9]*" {...rest} className={cx(inputCls, 'mt-0 h-11 pl-7 tabular')} />
      </span>
      {hint ? <span className="mt-1 block text-[12px] font-normal text-ink-400">{hint}</span> : null}
    </label>
  );
}

export function rupeesToPaise(v: FormDataEntryValue | null): number {
  const n = Number(String(v ?? '').replace(/[,\s₹]/g, ''));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN;
}

export function Select({ label, children, className, ...rest }: { label: string; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className={cx('block text-[13px] font-semibold text-ink-700', className)}>
      {label}
      <select {...rest} className={cx(inputCls, 'h-11')}>
        {children}
      </select>
    </label>
  );
}

export function TextArea({ label, className, ...rest }: { label: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className={cx('block text-[13px] font-semibold text-ink-700', className)}>
      {label}
      <textarea {...rest} className={cx(inputCls, 'py-2.5')} />
    </label>
  );
}

export function CheckGroup<T extends string>({ label, name, options, defaultValue = [] }: { label: string; name: string; options: { value: T; label: string }[]; defaultValue?: T[] }) {
  return (
    <fieldset>
      <legend className="text-[13px] font-semibold text-ink-700">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o.value} className="cursor-pointer">
            <input type="checkbox" name={name} value={o.value} defaultChecked={defaultValue.includes(o.value)} className="peer sr-only" />
            <span className="inline-flex h-9 items-center rounded-full border border-line-strong bg-surface px-3.5 text-[13px] font-medium text-ink-700 transition-colors peer-checked:border-navy-700 peer-checked:bg-navy-700 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-navy-300">
              {o.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function FormError({ error }: { error: string | null }) {
  return error ? (
    <p className="rounded-lg bg-bad-100 px-3 py-2 text-[13px] font-medium text-bad-600" role="alert">
      {error}
    </p>
  ) : null;
}

export function Dialog({ title, children, onClose, wide }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-navy-950/40 sm:place-items-center sm:p-4" onClick={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx('max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-surface p-6 shadow-[var(--shadow-raised)] outline-none sm:rounded-2xl', wide ? 'max-w-2xl' : 'max-w-md')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-[18px] font-bold">{title}</h3>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function formValues(form: HTMLFormElement, multi: string[] = []) {
  const f = new FormData(form);
  const out: Record<string, unknown> = Object.fromEntries(f.entries());
  for (const k of multi) out[k] = f.getAll(k).map(String);
  return out;
}
