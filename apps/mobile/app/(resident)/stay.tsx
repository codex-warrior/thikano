import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { color } from '@thikano/tokens';
import { toFriendly } from '@thikano/client';
import { formatINR, INVOICE_STATUS_LABEL, MAINTENANCE_CATEGORY_LABEL, ROOM_AMENITY_LABEL, SHARING_LABEL, type MaintenanceCategory } from '@thikano/domain';
import { firebase } from '@/src/firebase';
import { useResident } from '@/src/resident';
import { Body, Button, Card, Eyebrow, H1, Icon, Input, Screen, SectionTitle, Sheet, SkeletonCards, Small, type IconName } from '@/src/ui';

const CATEGORIES: { key: MaintenanceCategory; icon: IconName }[] = [
  { key: 'ac', icon: 'wind' },
  { key: 'fan', icon: 'loader' },
  { key: 'wifi', icon: 'wifi' },
  { key: 'water', icon: 'droplet' },
  { key: 'electrical', icon: 'zap' },
  { key: 'furniture', icon: 'archive' },
  { key: 'plumbing', icon: 'tool' },
  { key: 'other', icon: 'more-horizontal' },
];

export default function MyStay() {
  const { data: h, reload } = useResident();
  const [reporting, setReporting] = useState(false);
  if (!h) {
    return (
      <Screen>
        <SkeletonCards />
      </Screen>
    );
  }
  const since = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }).format(h.resident.moveInDate);
  return (
    <Screen>
      <H1>My Stay</H1>
      <Card style={{ backgroundColor: color.navy[900], borderColor: color.navy[900], gap: 6 }}>
        <Eyebrow style={{ color: color.navy[300] }}>{h.property.name}</Eyebrow>
        <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800' }}>
          Room {h.room.number} · Bed {h.bed.label}
        </Text>
        <Text style={{ color: color.navy[200] }}>
          {SHARING_LABEL[h.room.sharing]} · Since {since}
        </Text>
        {h.resident.moveOutDate ? <Text style={{ color: color.marigold[500], fontWeight: '600' }}>Moving out {new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(h.resident.moveOutDate)}</Text> : null}
      </Card>

      <Button label="Report a problem" icon="tool" onPress={() => setReporting(true)} />
      {h.issues.length ? (
        <Card style={{ padding: 0 }}>
          {h.issues.slice(0, 5).map((m, i) => (
            <View key={m.id} style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 14, borderTopWidth: i ? 1 : 0, borderTopColor: color.border }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700' }}>{MAINTENANCE_CATEGORY_LABEL[m.category]}</Text>
                <Small numberOfLines={1}>{m.description}</Small>
              </View>
              <Small style={{ color: m.status === 'resolved' ? color.success[600] : color.warning[600], fontWeight: '700' }}>{m.status.replace('_', ' ')}</Small>
            </View>
          ))}
        </Card>
      ) : null}

      <SectionTitle title="Roommates" />
      <Card>
        <Body>{h.roommates.length ? h.roommates.join(', ') : 'No roommates right now'}</Body>
      </Card>

      <SectionTitle title="Rent" />
      <Card style={{ gap: 10 }}>
        <Row icon="credit-card" label="Monthly rent" value={formatINR(h.resident.rent)} />
        <Row icon="lock" label="Deposit" value={formatINR(h.resident.deposit)} />
        <Row icon="calendar" label="Due every month on" value={`${h.resident.rentDueDay}th`} />
        {h.invoices.slice(0, 6).map((i) => (
          <Row key={i.id} icon="file-text" label={i.period} value={`${formatINR(i.amount + i.lateFee)} · ${INVOICE_STATUS_LABEL[i.status]}`} />
        ))}
      </Card>

      <SectionTitle title="Your room" />
      <Card>
        <Body>{h.room.amenities.map((a) => ROOM_AMENITY_LABEL[a]).join(' • ') || '—'}</Body>
      </Card>

      {h.property.rules.length ? (
        <>
          <SectionTitle title="House rules" />
          <Card style={{ gap: 6 }}>
            {h.property.rules.map((r) => (
              <Body key={r}>• {r}</Body>
            ))}
          </Card>
        </>
      ) : null}

      <SectionTitle title="Contact" />
      <Card>
        <Body>{h.property.contactPhone ? `Property office: ${h.property.contactPhone}` : 'Contact your property manager at the front desk.'}</Body>
      </Card>

      <ReportSheet visible={reporting} onClose={() => setReporting(false)} onDone={reload} roomLabel={`Room ${h.room.number} · Bed ${h.bed.label}`} />
    </Screen>
  );
}

/** Location is known from the stay — the resident only says what's wrong. */
function ReportSheet({ visible, onClose, onDone, roomLabel }: { visible: boolean; onClose: () => void; onDone: () => Promise<void>; roomLabel: string }) {
  const [category, setCategory] = useState<MaintenanceCategory | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function send() {
    setBusy(true);
    setMsg(null);
    try {
      await firebase().call('raiseMaintenance', { category, description: text });
      setMsg('Request sent ✓');
      setText('');
      setCategory(null);
      await onDone();
      setTimeout(onClose, 900);
    } catch (e) {
      setMsg(toFriendly(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet visible={visible} title="What's wrong?" onClose={onClose}>
      <Small>{roomLabel} — we already know where you are.</Small>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {CATEGORIES.map((c) => {
          const on = c.key === category;
          return (
            <Pressable key={c.key} onPress={() => setCategory(c.key)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 38, borderRadius: 999, borderWidth: 1, borderColor: on ? color.navy[700] : color.border, backgroundColor: on ? color.navy[700] : color.surface }}>
              <Icon name={c.icon} size={14} color={on ? '#fff' : color.ink[500]} />
              <Text style={{ color: on ? '#fff' : color.ink[700], fontWeight: '600' }}>{MAINTENANCE_CATEGORY_LABEL[c.key]}</Text>
            </Pressable>
          );
        })}
      </View>
      <Input label="Details" value={text} onChangeText={setText} multiline maxLength={500} placeholder="e.g. AC not cooling since morning" />
      {msg ? <Small style={{ textAlign: 'center' }}>{msg}</Small> : null}
      <Button label={busy ? 'Sending…' : 'Send request'} disabled={!category || text.trim().length < 3 || busy} onPress={send} />
    </Sheet>
  );
}

function Row({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Icon name={icon} size={16} color={color.ink[400]} />
      <Small style={{ flex: 1 }}>{label}</Small>
      <Text style={{ fontWeight: '700', color: color.ink[900] }}>{value}</Text>
    </View>
  );
}
