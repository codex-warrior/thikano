import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { color, radius, status as statusTokens } from '@thikano/tokens';
import { formatINR, ROOM_AMENITY_LABEL, SHARING_LABEL, type Paise, type RoomAmenity, type SharingType } from '@thikano/domain';

export type IconName = ComponentProps<typeof Feather>['name'];
export const Icon = ({ name, size = 20, color: c = color.ink[700] }: { name: IconName; size?: number; color?: string }) => <Feather name={name} size={size} color={c} />;

// ───────────── type ─────────────
type TP = { children: ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number };
export const Display = ({ children, style }: TP) => <Text style={[t.display, style]}>{children}</Text>;
export const H1 = ({ children, style }: TP) => <Text style={[t.h1, style]}>{children}</Text>;
export const H2 = ({ children, style, numberOfLines }: TP) => (
  <Text style={[t.h2, style]} numberOfLines={numberOfLines}>
    {children}
  </Text>
);
export const Body = ({ children, style, numberOfLines }: TP) => (
  <Text style={[t.body, style]} numberOfLines={numberOfLines}>
    {children}
  </Text>
);
export const Small = ({ children, style, numberOfLines }: TP) => (
  <Text style={[t.small, style]} numberOfLines={numberOfLines}>
    {children}
  </Text>
);
export const Eyebrow = ({ children, style }: TP) => <Text style={[t.eyebrow, style]}>{children}</Text>;

// ───────────── layout ─────────────
export function Screen({ children, scroll = true, edges = ['top'], style }: { children: ReactNode; scroll?: boolean; edges?: ('top' | 'bottom')[]; style?: StyleProp<ViewStyle> }) {
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: color.bg }}>
      {scroll ? (
        <ScrollView contentContainerStyle={[{ padding: 20, paddingBottom: 40, gap: 16 }, style]} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1, padding: 20 }, style]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export const Card = ({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) =>
  onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => [s.card, style, pressed && { opacity: 0.92 }]}>
      {children}
    </Pressable>
  ) : (
    <View style={[s.card, style]}>{children}</View>
  );

export function Button({ label, onPress, variant = 'primary', icon, disabled, loading }: { label: string; onPress?: () => void; variant?: 'primary' | 'secondary' | 'ghost'; icon?: IconName; disabled?: boolean; loading?: boolean }) {
  const fg = variant === 'primary' ? '#fff' : color.navy[700];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [s.btn, variant === 'primary' ? s.btnPrimary : variant === 'secondary' ? s.btnSecondary : null, (pressed || disabled) && { opacity: disabled ? 0.5 : 0.85 }]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={18} color={fg} /> : null}
      <Text style={[s.btnText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Pill({ label, tone = 'available' }: { label: string; tone?: keyof typeof statusTokens | 'brand' }) {
  const c = tone === 'brand' ? { fg: color.accent[600], bg: color.accent[100] } : statusTokens[tone];
  return (
    <View style={[s.pill, { backgroundColor: c.bg }]}>
      <View style={[s.dot, { backgroundColor: c.fg }]} />
      <Text style={[s.pillText, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 8 }}>
      <H2>{title}</H2>
      {action ? (
        <Pressable onPress={onAction}>
          <Text style={{ color: color.navy[700], fontWeight: '600', fontSize: 13 }}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyState({ icon, title, body }: { icon: IconName; title: string; body?: string }) {
  return (
    <View style={{ alignItems: 'center', padding: 32, gap: 8, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: color.borderStrong }}>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: color.navy[50], alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} color={color.navy[600]} />
      </View>
      <Text style={[t.h2, { fontSize: 15 }]}>{title}</Text>
      {body ? <Small style={{ textAlign: 'center' }}>{body}</Small> : null}
    </View>
  );
}

/** Native twin of packages/web-ui RoomCard — same fields, same order. */
export function RoomCard({
  room,
  onPress,
  compact,
}: {
  room: { number: string; sharing: SharingType; rent: Paise; availableBeds: number; amenities: RoomAmenity[]; photoUrl?: string | null; propertyName?: string; distanceKm?: number | null };
  onPress?: () => void;
  compact?: boolean;
}) {
  return (
    <Card onPress={onPress} style={{ padding: 0, overflow: 'hidden' }}>
      {room.photoUrl ? <Image source={{ uri: room.photoUrl }} style={{ width: '100%', aspectRatio: compact ? 2 : 16 / 10, backgroundColor: color.navy[50] }} /> : null}
      <View style={{ padding: 14, gap: 4 }}>
        {room.propertyName ? <Eyebrow>{room.propertyName}</Eyebrow> : null}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <H2>Room {room.number}</H2>
          {room.distanceKm != null ? <Small>{room.distanceKm.toFixed(1)} km away</Small> : null}
        </View>
        <Small>{SHARING_LABEL[room.sharing]}</Small>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
          <Text style={t.price}>
            {formatINR(room.rent)}
            <Text style={t.small}> / month</Text>
          </Text>
          <Pill label={room.availableBeds > 0 ? `${room.availableBeds} bed${room.availableBeds === 1 ? '' : 's'} available` : 'Full'} tone={room.availableBeds > 0 ? 'available' : 'occupied'} />
        </View>
        {!compact && room.amenities.length ? (
          <Small numberOfLines={1} style={{ marginTop: 4 }}>
            {room.amenities
              .slice(0, 4)
              .map((a) => ROOM_AMENITY_LABEL[a])
              .join(' • ')}
          </Small>
        ) : null}
      </View>
    </Card>
  );
}

export const t = StyleSheet.create({
  display: { fontSize: 30, lineHeight: 36, fontWeight: '800', color: color.ink[900], letterSpacing: -0.5 },
  h1: { fontSize: 24, lineHeight: 30, fontWeight: '700', color: color.ink[900], letterSpacing: -0.3 },
  h2: { fontSize: 17, lineHeight: 23, fontWeight: '700', color: color.ink[900] },
  body: { fontSize: 15, lineHeight: 22, color: color.ink[700] },
  small: { fontSize: 13, lineHeight: 18, color: color.ink[500] },
  eyebrow: { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: color.ink[400] },
  price: { fontSize: 18, fontWeight: '800', color: color.ink[900], fontVariant: ['tabular-nums'] },
});

const s = StyleSheet.create({
  card: { backgroundColor: color.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: color.border, padding: 16 },
  btn: { height: 50, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18 },
  btnPrimary: { backgroundColor: color.navy[700] },
  btnSecondary: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.borderStrong },
  btnText: { fontSize: 15, fontWeight: '700' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 12, fontWeight: '700' },
});

// ───────────── states ─────────────
export function SkeletonCards({ count = 3, height = 220 }: { count?: number; height?: number }) {
  return (
    <View style={{ gap: 14 }} accessibilityLabel="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ height, borderRadius: radius.lg, backgroundColor: '#ECEBE6' }} />
      ))}
    </View>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={{ alignItems: 'center', padding: 28, gap: 10, borderRadius: radius.lg, backgroundColor: color.surface, borderWidth: 1, borderColor: color.border }}>
      <Icon name="wifi-off" color={color.ink[400]} />
      <Text style={[t.h2, { fontSize: 15, textAlign: 'center' }]}>{message}</Text>
      {onRetry ? <Button label="Try again" variant="secondary" icon="refresh-cw" onPress={onRetry} /> : null}
    </View>
  );
}

export function Input({ label, ...rest }: { label: string } & ComponentProps<typeof TextInput>) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: color.ink[700] }}>{label}</Text>
      <TextInput placeholderTextColor={color.ink[300]} {...rest} style={[{ height: 50, borderWidth: 1, borderColor: color.borderStrong, borderRadius: radius.md, backgroundColor: color.surface, paddingHorizontal: 14, fontSize: 16, color: color.ink[900] }, rest.multiline ? { height: 90, paddingTop: 12, textAlignVertical: 'top' } : null, rest.style]} />
    </View>
  );
}

export function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(7,14,34,0.4)' }} onPress={onClose} />
      <View style={{ backgroundColor: color.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34, gap: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={t.h2}>{title}</Text>
          <Pressable onPress={onClose} accessibilityLabel="Close" hitSlop={12}>
            <Icon name="x" />
          </Pressable>
        </View>
        {children}
      </View>
    </Modal>
  );
}
