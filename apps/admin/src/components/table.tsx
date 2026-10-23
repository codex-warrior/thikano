import type { ReactNode } from 'react';
import { Card, EmptyState, cx } from '@thikano/web-ui';

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  align?: 'right';
}

/** Consistent admin data table with an empty state. */
export function Table<T>({ rows, columns, rowKey, empty }: { rows: T[]; columns: Column<T>[]; rowKey: (r: T) => string; empty: { title: string; body?: string } }) {
  if (rows.length === 0) return <EmptyState title={empty.title} body={empty.body} />;
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-[13.5px]">
        <thead className="border-b border-line text-[12px] uppercase tracking-wide text-ink-400">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={cx('px-4 py-3 font-semibold', c.align === 'right' && 'text-right')}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={rowKey(r)} className="hover:bg-canvas/60">
              {columns.map((c) => (
                <td key={c.key} className={cx('px-4 py-3 align-middle', c.align === 'right' && 'tabular text-right')}>
                  {c.cell(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[26px] font-bold">{title}</h1>
        {subtitle ? <p className="mt-1 text-[14px] text-ink-500">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export const fmtDate = (t: number | null | undefined, withTime = false) =>
  t ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', ...(withTime ? { hour: 'numeric', minute: '2-digit' } : { year: 'numeric' }), timeZone: 'Asia/Kolkata' }).format(t) : '—';
