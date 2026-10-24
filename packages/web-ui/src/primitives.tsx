import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { AlertCircle, RotateCw } from 'lucide-react';

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

/** The Habistat house mark (docs/brand/habistat-mark.svg). */
export function LogoMark({ className, tone = 'dark' }: { className?: string; tone?: 'dark' | 'light' }) {
  return (
    <svg viewBox="0 0 375 342" className={className} aria-hidden="true">
      <path fill={tone === 'light' ? '#FFFFFF' : '#011C5B'} d="M5 272V137Q5 99 40 82L170 14Q195 0 222 14L324 76Q338 86 325 94L157 186Q135 199 135 222V330Q135 337 128 337H70Q5 337 5 272Z" />
      <path fill="#275DFC" d="M217 337V196Q217 178 235 170L318 135Q370 120 370 170V272Q370 337 305 337Z" />
    </svg>
  );
}

export function Logo({ tone = 'dark', size = 'md', suffix }: { tone?: 'dark' | 'light'; size?: 'sm' | 'md' | 'lg'; suffix?: string }) {
  const text = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-base' : 'text-lg';
  return (
    <span className={cx('inline-flex items-center gap-2 font-display font-extrabold tracking-[-0.01em]', text, tone === 'light' ? 'text-white' : 'text-brand-navy')}>
      <LogoMark tone={tone} className="h-[1.15em] w-auto" />
      <span>Habistat</span>
      {suffix ? <span className={cx('text-[0.62em] font-semibold tracking-[0.18em]', tone === 'light' ? 'text-navy-300' : 'text-ink-400')}>{suffix}</span> : null}
    </span>
  );
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'success' | 'danger';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-navy-700 text-white hover:bg-navy-800 active:bg-navy-900',
  secondary: 'bg-surface text-ink-900 border border-line-strong hover:bg-navy-50',
  ghost: 'text-navy-700 hover:bg-navy-50',
  success: 'bg-ok-600 text-white hover:brightness-95',
  danger: 'bg-surface text-bad-600 border border-line-strong hover:bg-bad-100',
};

export function buttonClass(variant: Variant = 'primary', size: 'sm' | 'md' | 'lg' = 'md') {
  const s = size === 'sm' ? 'h-8 px-3 text-[13px]' : size === 'lg' ? 'h-12 px-6 text-[15px]' : 'h-10 px-4 text-sm';
  return cx(
    'inline-flex items-center justify-center gap-2 rounded-lg font-semibold whitespace-nowrap transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none',
    s,
    VARIANTS[variant],
  );
}

export function Button({ variant = 'primary', size = 'md', className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  return <button className={cx(buttonClass(variant, size), className)} {...rest} />;
}

export function Card({ className, children, as: As = 'div' }: { className?: string; children: ReactNode; as?: 'div' | 'section' | 'article' }) {
  return <As className={cx('rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]', className)}>{children}</As>;
}

export function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-[17px] font-bold text-ink-900">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-[13px] text-ink-500">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'navy' | 'neutral' | 'brand';
const TONES: Record<Tone, string> = {
  ok: 'bg-ok-100 text-ok-600',
  warn: 'bg-warn-100 text-warn-600',
  bad: 'bg-bad-100 text-bad-600',
  info: 'bg-info-100 text-info-600',
  navy: 'bg-navy-100 text-navy-700',
  neutral: 'bg-[#EEEDE8] text-ink-500',
  brand: 'bg-accent-100 text-accent-600',
};

export function StatusPill({ tone, children, dot = true }: { tone: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-semibold', TONES[tone])}>
      {dot ? <span className="size-1.5 rounded-full bg-current" aria-hidden /> : null}
      {children}
    </span>
  );
}

export function StatTile({ label, value, hint, tone, icon }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'ok' | 'warn' | 'bad'; icon?: ReactNode }) {
  const hintTone = tone === 'ok' ? 'text-ok-600' : tone === 'warn' ? 'text-warn-600' : tone === 'bad' ? 'text-bad-600' : 'text-ink-500';
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between text-[12.5px] font-medium text-ink-500">
        <span>{label}</span>
        {icon ? <span className="text-ink-300">{icon}</span> : null}
      </div>
      <div className="tabular mt-2 font-display text-[26px] font-bold leading-none text-ink-900">{value}</div>
      {hint ? <div className={cx('mt-2 text-[12.5px] font-medium', hintTone)}>{hint}</div> : null}
    </Card>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-line-strong bg-surface/60 px-6 py-12 text-center">
      {icon ? <div className="mb-3 grid size-11 place-items-center rounded-full bg-navy-50 text-navy-600">{icon}</div> : null}
      <p className="font-display text-[15px] font-bold text-ink-900">{title}</p>
      {body ? <p className="mt-1 max-w-sm text-[13.5px] text-ink-500">{body}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ title = "We couldn't load this right now.", onRetry }: { title?: string; onRetry?: () => void }) {
  return (
    <EmptyState
      icon={<AlertCircle size={20} />}
      title={title}
      body="Please check your connection and try again."
      action={
        onRetry ? (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            <RotateCw size={14} /> Try again
          </Button>
        ) : undefined
      }
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-md bg-[#ECEBE6]', className)} aria-hidden />;
}

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <span className="grid shrink-0 place-items-center rounded-full bg-navy-100 font-semibold text-navy-700" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials}
    </span>
  );
}
