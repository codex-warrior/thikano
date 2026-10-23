import { Link } from 'expo-router';
import { EmptyState, Screen } from '@/src/ui';

export default function NotFound() {
  return (
    <Screen>
      <EmptyState icon="compass" title="This screen doesn't exist" />
      <Link href="/" style={{ textAlign: 'center', fontWeight: '600' }}>
        Go home
      </Link>
    </Screen>
  );
}
