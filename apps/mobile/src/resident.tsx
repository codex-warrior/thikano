import { createContext, useContext, type ReactNode } from 'react';
import { getResidentHome, type ResidentHome } from './data';
import { useAsync } from './use-async';

interface Ctx {
  data: ResidentHome | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}
const ResidentCtx = createContext<Ctx | null>(null);

/** One authorized fetch (getResidentHome) shared by every Resident tab; pull to refresh reloads it. */
export function ResidentProvider({ children }: { children: ReactNode }) {
  const v = useAsync(getResidentHome, []);
  return <ResidentCtx.Provider value={v}>{children}</ResidentCtx.Provider>;
}

export function useResident(): Ctx {
  const v = useContext(ResidentCtx);
  if (!v) throw new Error('useResident must be used inside ResidentProvider');
  return v;
}
