'use client';

import * as React from 'react';
import Link from 'next/link';

import { isSameLocalDay } from '../lib/dateHelpers';
import type { HomeDashboardDTO, HomeInsightsDTO } from '../lib/homeDashboardDTO';
import { AnalyzeTeaserCard } from './AnalyzeTeaserCard';
import { HomeGreeting } from './HomeGreeting';
import { InsightsList } from './InsightsList';
import { QuickStatsRow } from './QuickStatsRow';
import { RecentActivityList } from './RecentActivityList';
import { TodaysWorkoutCard } from './TodaysWorkoutCard';

interface Props {
  dto: HomeDashboardDTO;
  insightsDTO: HomeInsightsDTO;
}

const activityDateFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export function HomeDashboardView({ dto, insightsDTO }: Props) {
  const [clientNow, setClientNow] = React.useState<Date | null>(null);

  React.useEffect(() => {
    setClientNow(new Date());
  }, []);

  const todayCompletions = clientNow
    ? dto.recentCompletions.filter((r) => isSameLocalDay(r.startedAt, clientNow))
    : [];

  const recent = React.useMemo(
    () =>
      dto.recentCompletions.slice(0, 5).map((row) => ({
        ...row,
        formattedDate: clientNow ? activityDateFormat.format(new Date(row.startedAt)) : '',
      })),
    [dto.recentCompletions, clientNow],
  );

  return (
    <div className="space-y-6">
      <HomeGreeting />
      <TodaysWorkoutCard todayCompletions={todayCompletions} />
      <div className="flex justify-end">
        <Link
          href="/train/plans"
          className="inline-flex items-center text-sm text-primary hover:underline"
        >
          My Plans →
        </Link>
      </div>
      <QuickStatsRow
        workoutsThisWeek={insightsDTO.workoutsThisWeek}
        consistencyMessage={insightsDTO.consistency.message}
      />
      <InsightsList messages={insightsDTO.topMessages} hasEnoughData={insightsDTO.hasEnoughData} />
      <RecentActivityList rows={recent} />
      <AnalyzeTeaserCard />
    </div>
  );
}
