import { EmptyState, H1, Screen } from '@/src/ui';

export default function Saved() {
  return (
    <Screen>
      <H1>Saved</H1>
      <EmptyState icon="heart" title="No saved rooms yet" body="Room saving and side-by-side comparison are on the roadmap. The public room data already includes everything a comparison needs." />
    </Screen>
  );
}
