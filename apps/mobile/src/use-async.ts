import { useCallback, useEffect, useRef, useState } from 'react';
import { toFriendly } from '@thikano/client';

/** Load data with loading / error / retry states. Never surfaces raw technical errors. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const load = useCallback(async () => {
    const id = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const r = await fn();
      if (id === seq.current) setData(r);
    } catch (e) {
      if (id === seq.current) setError(toFriendly(e));
    } finally {
      if (id === seq.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    void load();
  }, [load]);
  return { data, error, loading, reload: load };
}
