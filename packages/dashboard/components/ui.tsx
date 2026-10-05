'use client';

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-pink text-white hover:bg-[#f25596] shadow-sm shadow-pink/30',
  secondary: 'bg-white text-ink border border-line hover:bg-violet-soft',
  ghost: 'text-muted hover:text-ink hover:bg-violet-soft',
  danger: 'bg-white text-red-600 border border-red-200 hover:bg-red-50',
};

export function Button({ variant = 'primary', loading, className, children, disabled, ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx('inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition',
        'disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet',
        VARIANTS[variant], className)}
    >
      {loading && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-2xl border border-line bg-white p-5 shadow-sm shadow-violet/5', className)}>{children}</div>;
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
}

const inputCls = 'w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-muted/70 focus:border-violet focus:outline-none focus:ring-2 focus:ring-violet/20';

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputCls, props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(inputCls, props.className)} />;
}

export function Badge({ tone = 'violet', children }: { tone?: 'violet' | 'pink' | 'mint' | 'gray'; children: ReactNode }) {
  const tones = { violet: 'bg-violet-soft text-violet', pink: 'bg-pink-soft text-pink', mint: 'bg-mint-soft text-mint', gray: 'bg-gray-100 text-gray-500' };
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', tones[tone])}>{children}</span>;
}

export function Alert({ tone = 'error', children }: { tone?: 'error' | 'success' | 'info'; children: ReactNode }) {
  const tones = { error: 'border-red-200 bg-red-50 text-red-700', success: 'border-mint/30 bg-mint-soft text-[#2e8b75]', info: 'border-violet/20 bg-violet-soft text-ink' };
  return <div role={tone === 'error' ? 'alert' : 'status'} className={cx('rounded-xl border px-4 py-3 text-sm', tones[tone])}>{children}</div>;
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Spinner() {
  return <div className="flex justify-center py-16"><span className="size-6 animate-spin rounded-full border-2 border-violet border-t-transparent" /></div>;
}

export { cx };
