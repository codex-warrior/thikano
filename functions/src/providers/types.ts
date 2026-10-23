import type { Paise, ServiceCategory, ServiceOrderStatus } from '@thikano/domain';

/**
 * THIKANO ↔ service provider contract. Business logic only ever talks to this
 * interface; Dwarpar and every future provider is an adapter behind it.
 */
export interface CatalogItem {
  sku: string;
  name: string;
  description?: string;
  category: ServiceCategory;
  price: Paise;
  unit?: string; // "per kg", "per piece"
  available: boolean;
}

export interface CreateOrderInput {
  orderId: string; // THIKANO order id (idempotency key)
  propertyId: string;
  deliverTo: { propertyName: string; locality: string; city: string; room: string; residentName: string; phone: string | null };
  items: { sku: string; qty: number }[];
}

export interface ProviderOrder {
  providerOrderRef: string;
  status: ServiceOrderStatus;
  etaMinutes?: number | null;
}

export interface ServiceProvider {
  readonly id: string;
  getServices(ctx: { propertyId: string; category?: ServiceCategory }): Promise<CatalogItem[]>;
  createOrder(input: CreateOrderInput): Promise<ProviderOrder>;
  getOrderStatus(providerOrderRef: string): Promise<ServiceOrderStatus>;
  cancelOrder(providerOrderRef: string): Promise<void>;
}
