'use client';

import { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { toFriendly } from '@thikano/client';
import { formatINR } from '@thikano/domain';
import { Card, Skeleton } from '@thikano/web-ui';
import { firebase } from '@/lib/firebase';

interface Insights {
  vacantBeds: number;
  lostMonthlyRevenue: number;
  upcomingVacancies: number;
  demand: { studentsSearchingNearby: number; matchingYourRooms: number; level: 'low' | 'medium' | 'high'; windowDays: number; radiusKm: number };
  recommendation: string;
}

/** Deterministic vacancy + demand intelligence (functions/src/platform.ts → getPropertyInsights). */
export function InsightsCard({ orgId, propertyId }: { orgId: string; propertyId: string }) {
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        await firebase().auth.authStateReady();
        const r = await firebase().call<unknown, Insights>('getPropertyInsights', { orgId, propertyId });
        if (live) setData(r);
      } catch (e) {
        if (live) setError(toFriendly(e));
      }
    })();
    return () => {
      live = false;
    };
  }, [orgId, propertyId]);

  if (error) return <Card className="p-4 text-[13px] text-ink-500">Demand insights are unavailable right now.</Card>;
  if (!data) return <Skeleton className="h-28 w-full rounded-[var(--radius-card)]" />;
  const levelTone = data.demand.level === 'high' ? 'text-ok-600' : data.demand.level === 'medium' ? 'text-warn-600' : 'text-ink-500';
  return (
    <Card className="grid gap-4 p-5 md:grid-cols-[1fr_1fr_1.4fr]">
      <div>
        <p className="text-[12.5px] font-medium text-ink-500">Students searching nearby</p>
        <p className="tabular mt-1 font-display text-[24px] font-bold">{data.demand.studentsSearchingNearby}</p>
        <p className="text-[12px] text-ink-400">
          last {data.demand.windowDays} days · within {data.demand.radiusKm} km · demand <b className={levelTone}>{data.demand.level.toUpperCase()}</b>
        </p>
      </div>
      <div>
        <p className="text-[12.5px] font-medium text-ink-500">Matching your vacant rooms</p>
        <p className="tabular mt-1 font-display text-[24px] font-bold">{data.demand.matchingYourRooms}</p>
        <p className="text-[12px] text-ink-400">by budget and sharing type</p>
      </div>
      <div className="flex gap-3 rounded-xl bg-navy-50 p-4">
        <TrendingUp size={18} className="mt-0.5 shrink-0 text-navy-600" />
        <div>
          <p className="text-[12.5px] font-semibold text-navy-700">Recommended</p>
          <p className="mt-0.5 text-[13.5px] text-ink-700">{data.recommendation}</p>
          {data.lostMonthlyRevenue > 0 ? <p className="mt-1 text-[12px] text-ink-500">Estimated lost revenue: {formatINR(data.lostMonthlyRevenue)}/month</p> : null}
        </div>
      </div>
    </Card>
  );
}
