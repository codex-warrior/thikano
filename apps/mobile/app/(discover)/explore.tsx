import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { color, radius } from '@thikano/tokens';
import { formatINR, type SearchFilters } from '@thikano/domain';
import { PLACES, searchNear } from '@/src/data';
import { useAsync } from '@/src/use-async';
import { Body, Card, EmptyState, ErrorBox, H1, H2, Icon, Pill, Screen, SkeletonCards, Small } from '@/src/ui';

type FilterKey = 'food' | 'ac' | 'wifi' | 'budget' | 'double';
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'budget', label: 'Under ₹10k' },
  { key: 'double', label: 'Double sharing' },
  { key: 'food', label: 'Food' },
  { key: 'ac', label: 'AC' },
  { key: 'wifi', label: 'Wi-Fi' },
];

/** Location-first Discover: real availability only. */
export default function Explore() {
  const [place, setPlace] = useState(PLACES[0]!);
  const [active, setActive] = useState<Set<FilterKey>>(new Set());
  const filters: SearchFilters = {
    maxDistanceKm: 8,
    food: active.has('food') || undefined,
    ac: active.has('ac') || undefined,
    wifi: active.has('wifi') || undefined,
    maxRent: active.has('budget') ? 10_000_00 : undefined,
    sharing: active.has('double') ? ['double'] : undefined,
  };
  const { data, error, loading, reload } = useAsync(() => searchNear(place, filters), [place.label, [...active].sort().join()]);

  const toggle = (k: FilterKey) =>
    setActive((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  return (
    <Screen>
      <H1>Where do you want to live?</H1>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {PLACES.map((p) => {
          const on = p.label === place.label;
          return (
            <Pressable
              key={p.label}
              onPress={() => setPlace(p)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 38, borderRadius: 999, backgroundColor: on ? color.navy[700] : color.surface, borderWidth: 1, borderColor: on ? color.navy[700] : color.border }}
            >
              <Icon name={p.kind === 'college' ? 'book-open' : 'map-pin'} size={14} color={on ? '#fff' : color.ink[500]} />
              <Text style={{ color: on ? '#fff' : color.ink[700], fontWeight: '600', fontSize: 13.5 }}>{p.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => {
          const on = active.has(f.key);
          return (
            <Pressable key={f.key} onPress={() => toggle(f.key)} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ paddingHorizontal: 12, height: 32, justifyContent: 'center', borderRadius: radius.sm, backgroundColor: on ? color.navy[100] : 'transparent', borderWidth: 1, borderColor: on ? color.navy[300] : color.border }}>
              <Text style={{ fontSize: 12.5, fontWeight: '600', color: on ? color.navy[700] : color.ink[500] }}>{f.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View>
        <H2>PGs near {place.label}</H2>
        {data ? (
          <Small>
            {data.rooms.length} available room{data.rooms.length === 1 ? '' : 's'}
          </Small>
        ) : null}
      </View>

      {loading && !data ? (
        <SkeletonCards />
      ) : error ? (
        <ErrorBox message="We couldn't load PGs right now." onRetry={reload} />
      ) : !data || data.properties.length === 0 ? (
        <EmptyState icon="search" title="No rooms match" body="Try removing a filter or searching another area." />
      ) : (
        data.properties.map((p) => (
          <Card key={p.propertyId} style={{ padding: 0, overflow: 'hidden' }} onPress={() => router.push({ pathname: '/property/[id]', params: { id: p.propertyId } })}>
            {p.coverPhotoUrl ? <Image source={{ uri: p.coverPhotoUrl }} style={{ width: '100%', aspectRatio: 2.1, backgroundColor: color.navy[50] }} /> : null}
            <View style={{ padding: 14, gap: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <H2>{p.propertyName}</H2>
                {p.rating ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Icon name="star" size={13} color={color.marigold[500]} />
                    <Text style={{ fontWeight: '700', color: color.ink[700] }}>{p.rating}</Text>
                  </View>
                ) : null}
              </View>
              <Small>
                {p.locality}
                {p.distanceKm != null ? ` · ${p.distanceKm.toFixed(1)} km away` : ''}
              </Small>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                <Body>
                  from <Text style={{ fontWeight: '800', color: color.ink[900] }}>{formatINR(p.startingRent)}</Text>/month
                </Body>
                <Pill label={`${p.availableBeds} bed${p.availableBeds === 1 ? '' : 's'} available`} />
              </View>
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}
