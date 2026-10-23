# THIKANO — Services & Partner Economics

## Provider abstraction

```ts
interface ServiceProvider {
  id: string;
  getServices(ctx: { propertyId: string }): Promise<Service[]>;
  createOrder(input: CreateOrderInput): Promise<ProviderOrder>;
  getOrderStatus(providerOrderRef: string): Promise<ServiceOrderStatus>;
  cancelOrder(providerOrderRef: string): Promise<void>;
}
```

Adapters live in `functions/src/providers/`: `MockProvider` (development and tests), `DwarparAdapter` (the first external provider), and future laundry, cleaning, grocery and pharmacy adapters. The resident only talks to THIKANO. Provider webhooks update `serviceOrders/{id}.status`, which fans out to the resident feed and to push notifications.

**Dwarpar status:** no API documentation or credentials exist in this repo yet. The adapter is a typed stub behind `providers/dwarpar.adapter = "mock" | "live"`, and running it live without credentials throws. It does not pretend to place real orders.

## Revenue split: THIKANO Partner Share

```text
Service Order → Gross
   ├─ Provider share
   ├─ THIKANO share      (receives the rounding remainder, so the parts sum exactly to gross)
   ├─ Property partner share
   └─ Other fees (gateway etc.)
```

- Rules are data, not code: `revenueRules/{id}` with basis points that must sum to 10,000.
- Resolution picks the **most specific** active rule in its effective window (property > org > provider > category > default), with ties broken by `priority` and then by the latest `effectiveFrom`.
- The split is computed once, server-side, when the order is delivered, and the resolved `ruleId` is stored. Later rule changes never rewrite history.
- `platformLedger` holds the full split and is admin-only. The org's `ledger` holds only the partner share, by category and month.

All of this is implemented in `packages/domain/src/economics.ts` and tested in `test/money-rent-economics.test.ts`.

## Owner earnings view

```text
THIKANO EARNINGS — October
₹17,850
Food ₹8,400 · Laundry ₹4,200 · Cleaning ₹2,100 · Groceries ₹1,650 · Other ₹1,500
```

These figures are built with `partnerEarningsByCategory(ledgerEntries)`.
