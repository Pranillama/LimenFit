export type { HomeDashboardDTO, HomeWorkoutSummary } from './lib/homeDashboardDTO';
export { buildHomeDashboardDTO, LOOKBACK_DAYS } from './lib/homeDashboardDTO';

export type { HomeQuickStats } from './lib/computeHomeStats';
export { computeQuickStats } from './lib/computeHomeStats';

export { isSameLocalDay, getWeekRange } from './lib/dateHelpers';

export { HomeDashboardView } from './components/HomeDashboardView';
export { HomeGreeting } from './components/HomeGreeting';
export { TodaysWorkoutCard } from './components/TodaysWorkoutCard';
export { QuickStatsRow } from './components/QuickStatsRow';
export { RecentActivityList } from './components/RecentActivityList';
export { AnalyzeTeaserCard } from './components/AnalyzeTeaserCard';
