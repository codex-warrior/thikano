'use client';

import { useState } from 'react';
import { formatINR } from '@thikano/domain';
import { Button } from '@thikano/web-ui';
import { useAction } from '@/lib/use-action';
import { Dialog, Field, FormError, MoneyField, rupeesToPaise, Select } from './form';

export function RecordPaymentButton({ orgId, invoiceId, name, due }: { orgId: string; invoiceId: string; name: string; due: number }) {
  const [open, setOpen] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);
  const { run, busy, error, setError } = useAction<Record<string, unknown>, { receiptNo: string }>('recordPayment');
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Collect
      </Button>
      {open ? (
        <Dialog title={`Record payment · ${name}`} onClose={() => (setOpen(false), setReceipt(null))}>
          {receipt ? (
            <div className="text-center">
              <p className="font-display text-[18px] font-bold text-ok-600">Payment recorded ✓</p>
              <p className="mt-1 text-[13.5px] text-ink-500">Receipt {receipt} — {name} sees it in their app.</p>
              <Button className="mt-4" variant="secondary" onClick={() => (setOpen(false), setReceipt(null))}>
                Done
              </Button>
            </div>
          ) : (
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const amount = rupeesToPaise(f.get('amount'));
                if (!Number.isFinite(amount) || amount <= 0) return setError('Please enter the amount received.');
                const r = await run({ orgId, invoiceId, amount, method: f.get('method'), reference: f.get('reference') || null });
                if (r) setReceipt(r.receiptNo);
              }}
            >
              <MoneyField label="Amount received" name="amount" defaultValue={due / 100} hint={`${formatINR(due)} due. Partial payments are fine.`} />
              <Select label="Paid by" name="method" defaultValue="upi">
                <option value="upi">UPI</option>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank transfer</option>
              </Select>
              <Field label="Reference (optional)" name="reference" placeholder="UPI ref / note" maxLength={80} />
              <FormError error={error} />
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? 'Saving…' : 'Record payment'}
              </Button>
            </form>
          )}
        </Dialog>
      ) : null}
    </>
  );
}

export function GenerateInvoicesButton({ orgId, propertyId, period }: { orgId: string; propertyId: string; period: string }) {
  const [created, setCreated] = useState<number | null>(null);
  const { run, busy, error } = useAction<Record<string, unknown>, { created: number }>('generateInvoicesNow');
  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="secondary" disabled={busy} onClick={async () => setCreated((await run({ orgId, propertyId, period }))?.created ?? null)}>
        {busy ? 'Generating…' : 'Generate this month’s rent'}
      </Button>
      {created != null ? <span className="text-[12.5px] text-ok-600">{created === 0 ? 'Everyone is already billed ✓' : `${created} invoices created ✓`}</span> : null}
      {error ? <span className="text-[12.5px] text-bad-600">{error}</span> : null}
    </div>
  );
}
