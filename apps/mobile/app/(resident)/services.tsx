import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { color, radius } from '@thikano/tokens';
import { toFriendly } from '@thikano/client';
import { formatINR } from '@thikano/domain';
import { getCatalog, type CatalogItem } from '@/src/data';
import { firebase } from '@/src/firebase';
import { useResident } from '@/src/resident';
import { useAsync } from '@/src/use-async';
import { Button, Card, EmptyState, ErrorBox, H1, H2, Icon, Screen, SectionTitle, SkeletonCards, Small, type IconName } from '@/src/ui';

const CATEGORIES: { key: string; label: string; icon: IconName }[] = [
  { key: 'food', label: 'Food', icon: 'coffee' },
  { key: 'laundry', label: 'Laundry', icon: 'wind' },
  { key: 'cleaning', label: 'Cleaning', icon: 'droplet' },
  { key: 'groceries', label: 'Groceries', icon: 'shopping-bag' },
  { key: 'pharmacy', label: 'Pharmacy', icon: 'plus-square' },
  { key: 'printing', label: 'Printing', icon: 'printer' },
  { key: 'courier', label: 'Courier', icon: 'send' },
  { key: 'repairs', label: 'Repairs', icon: 'tool' },
  { key: 'other', label: 'Other', icon: 'more-horizontal' },
];

/** Service marketplace. Prices come from the provider catalog; totals are recomputed server-side. */
export default function Services() {
  const [category, setCategory] = useState('food');
  const catalog = useAsync(() => getCatalog(category), [category]);
  const { data: home, reload } = useResident();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const provider = catalog.data?.providers[0];
  const items: CatalogItem[] = provider?.items ?? [];
  const total = items.reduce((a, i) => a + (cart[i.sku] ?? 0) * i.price, 0);

  async function order() {
    if (!provider) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await firebase().call<unknown, { gross: number }>('placeServiceOrder', { providerId: provider.providerId, items: Object.entries(cart).filter(([, q]) => q > 0).map(([sku, qty]) => ({ sku, qty })) });
      setCart({});
      setMsg(`Order placed ✓ ${formatINR(r.gross)} · ${provider.providerName}`);
      await reload();
    } catch (e) {
      setMsg(toFriendly(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <H1>Services</H1>
      <Small>Delivered to your room. Pay with your order.</Small>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {CATEGORIES.map((c) => {
          const on = c.key === category;
          return (
            <Pressable key={c.key} onPress={() => (setCategory(c.key), setCart({}), setMsg(null))} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ width: '31.5%', alignItems: 'center', gap: 6, paddingVertical: 14, borderRadius: radius.lg, backgroundColor: on ? color.navy[700] : color.surface, borderWidth: 1, borderColor: on ? color.navy[700] : color.border }}>
              <Icon name={c.icon} color={on ? '#fff' : color.navy[700]} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: on ? '#fff' : color.ink[700] }}>{c.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {catalog.loading && !catalog.data ? (
        <SkeletonCards count={2} height={70} />
      ) : catalog.error ? (
        <ErrorBox message="We couldn't load services right now." onRetry={catalog.reload} />
      ) : !provider ? (
        <EmptyState icon="clock" title="Coming soon to your PG" body="This service isn't available at your property yet." />
      ) : (
        <>
          <SectionTitle title={provider.providerName} />
          <Card style={{ padding: 0 }}>
            {items.map((i, k) => (
              <View key={i.sku} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderTopWidth: k ? 1 : 0, borderTopColor: color.border }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: color.ink[900] }}>{i.name}</Text>
                  <Small>
                    {formatINR(i.price)}
                    {i.unit ? ` ${i.unit}` : ''}
                  </Small>
                </View>
                <Stepper value={cart[i.sku] ?? 0} onChange={(q) => setCart((c) => ({ ...c, [i.sku]: q }))} />
              </View>
            ))}
          </Card>
          <Button label={busy ? 'Placing order…' : total ? `Order · ${formatINR(total)}` : 'Choose items'} disabled={!total || busy} onPress={order} />
          {msg ? <Small style={{ textAlign: 'center' }}>{msg}</Small> : null}
        </>
      )}

      {home?.orders.length ? (
        <>
          <SectionTitle title="Your orders" />
          <Card style={{ padding: 0 }}>
            {home.orders.slice(0, 6).map((o, k) => (
              <View key={o.id} style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 14, borderTopWidth: k ? 1 : 0, borderTopColor: color.border }}>
                <View style={{ flex: 1 }}>
                  <H2 style={{ fontSize: 14 }} numberOfLines={1}>
                    {o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}
                  </H2>
                  <Small>{o.providerName}</Small>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontWeight: '700' }}>{formatINR(o.gross)}</Text>
                  <Small>{o.status.replace('_', ' ')}</Small>
                </View>
              </View>
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

function Stepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const btn = { width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: color.borderStrong, alignItems: 'center' as const, justifyContent: 'center' as const };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {value > 0 ? (
        <Pressable style={btn} onPress={() => onChange(value - 1)} accessibilityLabel="Remove one">
          <Icon name="minus" size={15} />
        </Pressable>
      ) : null}
      {value > 0 ? <Text style={{ minWidth: 16, textAlign: 'center', fontWeight: '700' }}>{value}</Text> : null}
      <Pressable style={[btn, { backgroundColor: color.navy[700], borderColor: color.navy[700] }]} onPress={() => onChange(Math.min(20, value + 1))} accessibilityLabel="Add one">
        <Icon name="plus" size={15} color="#fff" />
      </Pressable>
    </View>
  );
}
