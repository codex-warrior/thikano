import { router, useLocalSearchParams } from 'expo-router';
import { Image, Text, View } from 'react-native';
import { color } from '@thikano/tokens';
import { formatINR, PROPERTY_AMENITY_LABEL } from '@thikano/domain';
import { getPublicProperty } from '@/src/data';
import { useAsync } from '@/src/use-async';
import { Body, EmptyState, ErrorBox, H1, Icon, Pill, RoomCard, Screen, SectionTitle, SkeletonCards, Small } from '@/src/ui';

export default function PropertyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, loading, reload } = useAsync(() => getPublicProperty(id), [id]);
  if (loading && !data) {
    return (
      <Screen edges={[]}>
        <SkeletonCards count={2} />
      </Screen>
    );
  }
  if (error) {
    return (
      <Screen edges={[]}>
        <ErrorBox message="We couldn't load this PG right now." onRetry={reload} />
      </Screen>
    );
  }
  if (!data) {
    return (
      <Screen edges={[]}>
        <EmptyState icon="alert-circle" title="This PG isn't available" body="It may no longer be listed on Habistat." />
      </Screen>
    );
  }
  const { property: p, rooms } = data;
  return (
    <Screen edges={[]}>
      {p.photoUrls[0] ? <Image source={{ uri: p.photoUrls[0] }} style={{ width: '100%', aspectRatio: 1.6, borderRadius: 16, backgroundColor: color.navy[50] }} /> : null}
      <View style={{ gap: 4 }}>
        <H1>{p.name}</H1>
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          {p.rating ? (
            <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
              <Icon name="star" size={14} color={color.accent[500]} />
              <Text style={{ fontWeight: '700' }}>{p.rating}</Text>
            </View>
          ) : null}
          <Small>
            {p.locality}, {p.city}
          </Small>
          <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
            <Icon name="shield" size={13} color={color.success[600]} />
            <Small style={{ color: color.success[600] }}>Verified</Small>
          </View>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          {p.startingRent ? (
            <Body>
              Starting from <Text style={{ fontWeight: '800', color: color.ink[900] }}>{formatINR(p.startingRent)}</Text>/month
            </Body>
          ) : null}
          <Pill label={p.availableBeds ? `${p.availableBeds} beds available` : 'Currently full'} tone={p.availableBeds ? 'available' : 'occupied'} />
        </View>
      </View>

      <SectionTitle title="Amenities" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {p.amenities.map((a) => (
          <View key={a} style={{ flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: color.surface, borderWidth: 1, borderColor: color.border, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
            <Icon name="check" size={13} color={color.success[600]} />
            <Text style={{ fontSize: 13, color: color.ink[700] }}>{PROPERTY_AMENITY_LABEL[a]}</Text>
          </View>
        ))}
      </View>

      <SectionTitle title="Available rooms" />
      {rooms.length === 0 ? (
        <EmptyState icon="home" title="No rooms available right now" body="This property is fully occupied." />
      ) : (
        rooms.map((r) => (
          <RoomCard key={r.roomId} compact room={{ number: r.number, sharing: r.sharing, rent: r.rent, availableBeds: r.availableBeds, amenities: r.roomAmenities, photoUrl: r.coverPhotoUrl }} onPress={() => router.push({ pathname: '/room/[slug]', params: { slug: r.slug } })} />
        ))
      )}
      <SectionTitle title="About" />
      <Body>{p.description}</Body>
      {p.rules.length ? (
        <>
          <SectionTitle title="House rules" />
          {p.rules.map((r) => (
            <Body key={r}>• {r}</Body>
          ))}
        </>
      ) : null}
    </Screen>
  );
}
