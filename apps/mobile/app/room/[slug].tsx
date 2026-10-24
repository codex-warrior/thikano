import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Dimensions, FlatList, Image, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { color } from '@thikano/tokens';
import { toFriendly } from '@thikano/client';
import { formatINR, PROPERTY_AMENITY_LABEL, ROOM_AMENITY_LABEL, SHARING_LABEL } from '@thikano/domain';
import { getPublicRoom } from '@/src/data';
import { firebase } from '@/src/firebase';
import { useSession } from '@/src/session';
import { useAsync } from '@/src/use-async';
import { Body, Button, Card, EmptyState, ErrorBox, Eyebrow, H1, Icon, Input, Pill, Screen, SectionTitle, Sheet, SkeletonCards, Small } from '@/src/ui';

const W = Dimensions.get('window').width;

export default function RoomScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data: room, error, loading, reload } = useAsync(() => getPublicRoom(slug), [slug]);
  const [intent, setIntent] = useState<null | 'interested' | 'visit'>(null);
  const [sent, setSent] = useState(false);

  if (loading && !room) {
    return (
      <Screen edges={[]}>
        <SkeletonCards count={2} />
      </Screen>
    );
  }
  if (error) {
    return (
      <Screen edges={[]}>
        <ErrorBox message="We couldn't load this room right now." onRetry={reload} />
      </Screen>
    );
  }
  if (!room) {
    return (
      <Screen edges={[]}>
        <EmptyState icon="alert-circle" title="This room isn't available" body="It may have been booked or unlisted." />
      </Screen>
    );
  }
  const full = room.availableBeds === 0 || room.listingStatus !== 'published';
  return (
    <View style={{ flex: 1 }}>
      <Screen edges={[]} style={{ paddingTop: 0, paddingBottom: 130 }}>
        <FlatList
          data={room.photoUrls}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(u) => u}
          style={{ marginHorizontal: -20 }}
          renderItem={({ item }) => <Image source={{ uri: item }} style={{ width: W, aspectRatio: 4 / 3, backgroundColor: color.navy[50] }} />}
        />
        <View style={{ gap: 4 }}>
          <Eyebrow>{room.propertyName}</Eyebrow>
          <H1>Room {room.number}</H1>
          <Small>{SHARING_LABEL[room.sharing]}</Small>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <Text style={{ fontSize: 24, fontWeight: '800', color: color.ink[900] }}>
              {formatINR(room.rent)}
              <Text style={{ fontSize: 13, fontWeight: '500', color: color.ink[500] }}> / month</Text>
            </Text>
            <Pill label={full ? 'Currently full' : `${room.availableBeds} bed${room.availableBeds === 1 ? '' : 's'} available`} tone={full ? 'occupied' : 'available'} />
          </View>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 4 }}>
            <Icon name="shield" size={14} color={color.success[600]} />
            <Small style={{ color: color.success[600] }}>Verified by Habistat · {room.locality}</Small>
          </View>
        </View>

        <SectionTitle title="In this room" />
        <Card style={{ gap: 8 }}>
          {room.roomAmenities.map((a) => (
            <View key={a} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Icon name="check" size={15} color={color.success[600]} />
              <Body>{ROOM_AMENITY_LABEL[a]}</Body>
            </View>
          ))}
        </Card>
        <SectionTitle title="At the property" />
        <Body>{room.propertyAmenities.map((a) => PROPERTY_AMENITY_LABEL[a]).join(' • ')}</Body>
        <SectionTitle title="Costs" />
        <Card style={{ gap: 6 }}>
          <Row label="Monthly rent (per bed)" value={formatINR(room.rent)} />
          <Row label="Security deposit" value={formatINR(room.deposit)} />
          <Row label="Food" value={room.foodIncluded ? 'Included' : 'Not included'} />
        </Card>
      </Screen>

      {full ? null : (
        <SafeAreaView edges={['bottom']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: color.surface, borderTopWidth: 1, borderTopColor: color.border }}>
          {sent ? (
            <View style={{ padding: 16, alignItems: 'center' }}>
              <Text style={{ fontWeight: '700', color: color.success[600], fontSize: 15 }}>Request sent ✓ The owner will call you soon.</Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 10, padding: 14 }}>
              <View style={{ flex: 1 }}>
                <Button label="Request visit" variant="secondary" onPress={() => setIntent('visit')} />
              </View>
              <View style={{ flex: 1.3 }}>
                <Button label="I'm interested" icon="heart" onPress={() => setIntent('interested')} />
              </View>
            </View>
          )}
        </SafeAreaView>
      )}
      <LeadSheet slug={room.slug} intent={intent} onClose={() => setIntent(null)} onSent={() => (setIntent(null), setSent(true))} />
    </View>
  );
}

function LeadSheet({ slug, intent, onClose, onSent }: { slug: string; intent: null | 'interested' | 'visit'; onClose: () => void; onSent: () => void }) {
  const { profile } = useSession();
  const [name, setName] = useState(profile?.displayName ?? '');
  const [phone, setPhone] = useState(profile?.phone?.replace('+91', '') ?? '');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function send() {
    setBusy(true);
    setError(null);
    try {
      await firebase().call('createLead', { slug, name, phone, intent, message, source: 'discover' });
      onSent();
    } catch (e) {
      setError(toFriendly(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet visible={!!intent} title={intent === 'visit' ? 'Request a visit' : "I'm interested"} onClose={onClose}>
      <Input label="Your name" value={name} onChangeText={setName} autoComplete="name" />
      <Input label="Mobile number" value={phone} onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))} keyboardType="phone-pad" placeholder="98XXXXXXXX" />
      <Input label="Message (optional)" value={message} onChangeText={setMessage} multiline maxLength={500} />
      {error ? <Text style={{ color: color.danger[600], fontWeight: '600' }}>{error}</Text> : null}
      <Button label={busy ? 'Sending…' : 'Send'} disabled={busy || name.trim().length < 2 || phone.length !== 10} onPress={send} />
      <Small style={{ textAlign: 'center' }}>Your number is shared only with this property&apos;s owner.</Small>
    </Sheet>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Small>{label}</Small>
      <Text style={{ fontWeight: '700', color: color.ink[900] }}>{value}</Text>
    </View>
  );
}
