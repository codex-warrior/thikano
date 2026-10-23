import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { color, radius } from '@thikano/tokens';
import { toFriendly } from '@thikano/client';
import { formatINR, INVOICE_STATUS_LABEL, MAINTENANCE_CATEGORY_LABEL } from '@thikano/domain';
import { firebase } from '@/src/firebase';
import { useResident } from '@/src/resident';
import { Body, Button, Card, ErrorBox, Eyebrow, H1, Icon, SkeletonCards, Small, type IconName } from '@/src/ui';

interface FeedItem {
  key: string;
  icon: IconName;
  tint: string;
  bg: string;
  title: string;
  detail: string;
  at: number;
}

const time = (ms: number) => new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(ms);
const day = (ms: number) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }).format(ms);
const ORDER_LABEL: Record<string, string> = { placed: 'placed', accepted: 'accepted', in_progress: 'being prepared', ready: 'ready for pickup', delivered: 'delivered' };

/** THIKANO Daily — only real, useful items. No filler, no gamification. */
export default function ResidentHomeScreen() {
  const { data: h, error, loading, reload } = useResident();
  const [paying, setPaying] = useState(false);
  const [payMsg, setPayMsg] = useState<string | null>(null);

  if (!h) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: color.bg, padding: 20 }}>
        {error ? <ErrorBox message="We couldn't load your home right now." onRetry={reload} /> : <SkeletonCards />}
      </SafeAreaView>
    );
  }

  const first = h.resident.name.split(' ')[0];
  const hourIST = (new Date(h.now).getUTCHours() + 5.5) % 24;
  const greeting = hourIST < 12 ? 'Good morning' : hourIST < 17 ? 'Good afternoon' : 'Good evening';
  const feed: FeedItem[] = [];
  for (const o of h.orders.filter((x) => x.status !== 'delivered' && x.status !== 'cancelled' && x.status !== 'failed')) {
    feed.push({ key: o.id, icon: o.status === 'ready' ? 'package' : 'clock', tint: color.info[600], bg: color.info[100], title: `${o.category === 'laundry' ? 'Laundry' : o.items[0]?.name ?? 'Order'} ${ORDER_LABEL[o.status] ?? o.status}`, detail: o.providerName, at: o.updatedAt });
  }
  for (const p of h.parcels) feed.push({ key: p.id, icon: 'box', tint: color.marigold[600], bg: color.marigold[100], title: 'Parcel arrived', detail: `${p.carrier} · at ${p.location}`, at: p.arrivedAt });
  for (const n of h.notices.slice(0, 3)) {
    const when = n.startsAt ? `${day(n.startsAt)} ${time(n.startsAt)}${n.endsAt ? ` – ${time(n.endsAt)}` : ''}` : '';
    feed.push({ key: n.id, icon: 'volume-2', tint: color.warning[600], bg: color.warning[100], title: n.title, detail: [when, n.body].filter(Boolean).join(' · '), at: n.publishedAt });
  }
  for (const m of h.issues.filter((x) => x.status !== 'resolved' && x.status !== 'cancelled')) {
    feed.push({ key: m.id, icon: 'tool', tint: color.ink[500], bg: '#EEEDE8', title: `${MAINTENANCE_CATEGORY_LABEL[m.category]} request · ${m.status.replace('_', ' ')}`, detail: m.description, at: m.updatedAt });
  }
  feed.sort((a, b) => b.at - a.at);
  const due = h.invoices.filter((i) => i.outstanding > 0).sort((a, b) => a.dueDate - b.dueDate)[0];

  async function pay() {
    if (!due) return;
    setPaying(true);
    setPayMsg(null);
    try {
      const r = await firebase().call<unknown, { receiptNo: string; mode?: string }>('payRentOnline', { invoiceId: due.id });
      setPayMsg(`Paid ✓ Receipt ${r.receiptNo}${r.mode === 'test' ? ' (test mode)' : ''}`);
      await reload();
    } catch (e) {
      setPayMsg(toFriendly(e));
    } finally {
      setPaying(false);
    }
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: color.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 16 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}>
        <View>
          <H1>
            {greeting}, {first} 👋
          </H1>
          <Small style={{ marginTop: 4 }}>
            {h.property.name} · Room {h.room.number} · Bed {h.bed.label}
          </Small>
        </View>

        {due ? (
          <Card style={{ backgroundColor: due.status === 'overdue' ? color.danger[100] : color.surface, borderColor: due.status === 'overdue' ? '#F2C9C1' : color.border, gap: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Small>Rent · {new Intl.DateTimeFormat('en-IN', { month: 'long' }).format(due.dueDate + 6 * 3600_000)}</Small>
                <Text style={{ fontSize: 26, fontWeight: '800', color: color.ink[900] }}>{formatINR(due.outstanding)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontWeight: '700', color: due.status === 'overdue' ? color.danger[600] : color.ink[700] }}>{INVOICE_STATUS_LABEL[due.status]}</Text>
                <Small>Due {day(due.dueDate)}</Small>
              </View>
            </View>
            <Button label={paying ? 'Processing…' : `Pay ${formatINR(due.outstanding)}`} icon="credit-card" disabled={paying} onPress={pay} />
            {payMsg ? <Small style={{ textAlign: 'center' }}>{payMsg}</Small> : null}
          </Card>
        ) : (
          <Card style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Icon name="check-circle" color={color.success[600]} />
            <Body>Rent is all paid up. Nice!</Body>
          </Card>
        )}

        <Eyebrow style={{ marginTop: 8 }}>Today at your THIKANO</Eyebrow>
        {feed.length === 0 ? (
          <Card>
            <Body>All quiet today. Nothing needs you right now.</Body>
          </Card>
        ) : (
          <Card style={{ padding: 0 }}>
            {feed.map((f, i) => (
              <View key={f.key} style={{ flexDirection: 'row', gap: 12, padding: 14, borderTopWidth: i ? 1 : 0, borderTopColor: color.border }}>
                <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: f.bg, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={f.icon} size={18} color={f.tint} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: color.ink[900] }}>{f.title}</Text>
                  <Small numberOfLines={2}>{f.detail}</Small>
                </View>
              </View>
            ))}
          </Card>
        )}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Button label="Order food" variant="secondary" icon="coffee" onPress={() => router.push('/services')} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="Report issue" variant="secondary" icon="tool" onPress={() => router.push('/stay')} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
