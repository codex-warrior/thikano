import { useResident } from '@/src/resident';
import { Body, Card, EmptyState, H1, H2, Screen, Small, SkeletonCards } from '@/src/ui';

const when = (ms: number) => new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(ms);

/** Property-only community: announcements and events from your PG. Not a social network. */
export default function Community() {
  const { data: h } = useResident();
  if (!h) {
    return (
      <Screen>
        <SkeletonCards />
      </Screen>
    );
  }
  const upcoming = h.notices.filter((n) => n.startsAt && n.startsAt > h.now);
  const announcements = h.notices.filter((n) => !n.startsAt || n.startsAt <= h.now);
  return (
    <Screen>
      <H1>Community</H1>
      <Small>Only for residents of {h.property.name}.</Small>
      {upcoming.length ? <H2>Coming up</H2> : null}
      {upcoming.map((e) => (
        <Card key={e.id} style={{ gap: 4 }}>
          <H2>{e.title}</H2>
          <Small>{when(e.startsAt!)}</Small>
          {e.body ? <Body>{e.body}</Body> : null}
        </Card>
      ))}
      {announcements.length ? <H2>Announcements</H2> : null}
      {announcements.map((e) => (
        <Card key={e.id} style={{ gap: 4 }}>
          <H2>{e.title}</H2>
          {e.body ? <Body>{e.body}</Body> : null}
        </Card>
      ))}
      {h.notices.length === 0 ? <EmptyState icon="users" title="Nothing here yet" body="Events and announcements from your PG will show up here." /> : null}
    </Screen>
  );
}
