import type { ServiceOrderStatus } from '@thikano/domain';
import { db, isEmulator } from '../lib/admin';
import { fail } from '../lib/errors';
import type { CatalogItem, CreateOrderInput, ProviderOrder, ServiceProvider } from './types';

export type { CatalogItem, ServiceProvider } from './types';

interface ProviderDoc {
  id: string;
  name: string;
  status: 'active' | 'pending' | 'disabled';
  adapter: 'mock' | 'dwarpar';
  categories: string[];
}

/**
 * Catalog-backed provider: items live in providers/{id}/catalog, orders are tracked
 * by Habistat and advanced by the provider's partner console / status webhook.
 * Used for partners without an API (local laundry, cleaning crews) and in development.
 */
class CatalogProvider implements ServiceProvider {
  constructor(readonly id: string) {}
  async getServices(ctx: { category?: string }): Promise<CatalogItem[]> {
    let q = db.collection(`providers/${this.id}/catalog`).where('available', '==', true);
    if (ctx.category) q = q.where('category', '==', ctx.category);
    const snap = await q.limit(100).get();
    return snap.docs.map((d) => d.data() as CatalogItem);
  }
  async createOrder(input: CreateOrderInput): Promise<ProviderOrder> {
    return { providerOrderRef: `${this.id.toUpperCase()}-${input.orderId.slice(0, 8)}`, status: 'placed', etaMinutes: null };
  }
  async getOrderStatus(): Promise<ServiceOrderStatus> {
    return fail('unimplemented', 'Status is pushed by the partner for this provider.');
  }
  async cancelOrder(): Promise<void> {}
}

/**
 * Dwarpar adapter. API docs/credentials are not available yet, so live calls refuse
 * instead of pretending. Catalog + order capture work through CatalogProvider in the
 * meantime when `adapter: 'mock'` is configured for the provider.
 */
class DwarparAdapter implements ServiceProvider {
  readonly id = 'dwarpar';
  private notConfigured(): never {
    return fail('failed-precondition', 'Dwarpar ordering is not live yet.', { reason: 'DWARPAR_API_KEY / base URL not configured' });
  }
  private get config() {
    const base = process.env.DWARPAR_API_BASE;
    const key = process.env.DWARPAR_API_KEY;
    if (!base || !key) this.notConfigured();
    return { base: base!, key: key! };
  }
  async getServices(): Promise<CatalogItem[]> {
    this.config;
    return this.notConfigured();
  }
  async createOrder(): Promise<ProviderOrder> {
    this.config;
    return this.notConfigured();
  }
  async getOrderStatus(): Promise<ServiceOrderStatus> {
    this.config;
    return this.notConfigured();
  }
  async cancelOrder(): Promise<void> {
    this.config;
    this.notConfigured();
  }
}

export async function getProvider(providerId: string): Promise<{ doc: ProviderDoc; impl: ServiceProvider }> {
  const snap = await db.doc(`providers/${providerId}`).get();
  if (!snap.exists) return fail('not-found', "We couldn't find that service.");
  const doc = snap.data() as ProviderDoc;
  if (doc.status !== 'active') fail('failed-precondition', 'This service is not available right now.');
  if (doc.adapter === 'dwarpar') return { doc, impl: new DwarparAdapter() };
  if (doc.adapter === 'mock' && !isEmulator() && process.env.ALLOW_CATALOG_PROVIDERS !== 'true') {
    fail('failed-precondition', 'This service is not available right now.', { reason: 'catalog providers disabled in this environment' });
  }
  return { doc, impl: new CatalogProvider(providerId) };
}
