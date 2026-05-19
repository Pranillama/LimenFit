import { describe, expect, it } from 'vitest';
import { detectPlateaus } from '../plateau';
import type { OneRepMaxPoint } from '../types';

function point(
  exerciseId: string,
  workoutDate: string,
  e1rm: number,
  exerciseName = exerciseId,
  topSetWeight = e1rm,
  topSetReps = 1,
): OneRepMaxPoint {
  return {
    exerciseId,
    exerciseName,
    workoutId: `w-${workoutDate}`,
    workoutDate,
    e1rm,
    weightUnit: 'kg',
    topSetWeight,
    topSetReps,
  };
}

const BENCH_SESSIONS = [
  point('bench', '2024-01-01T10:00:00Z', 100),
  point('bench', '2024-01-08T10:00:00Z', 101),
  point('bench', '2024-01-15T10:00:00Z', 100.5),
  point('bench', '2024-01-22T10:00:00Z', 101),
];

describe('detectPlateaus', () => {
  it('returns empty array for empty input', () => {
    expect(detectPlateaus([])).toEqual([]);
  });

  it('skips exercises with fewer than minSessions points', () => {
    const sparse = [
      point('bench', '2024-01-01T10:00:00Z', 100),
      point('bench', '2024-01-08T10:00:00Z', 101),
      point('bench', '2024-01-15T10:00:00Z', 102),
    ];
    // Default minSessions=4; only 3 points → no output
    expect(detectPlateaus(sparse)).toHaveLength(0);
  });

  it('flags an exercise as plateauing when change < 2% (default threshold)', () => {
    // 100 → 101 = 1% < 2% → plateau
    const signals = detectPlateaus(BENCH_SESSIONS);
    expect(signals).toHaveLength(1);
    expect(signals[0].isPlateauing).toBe(true);
    expect(signals[0].exerciseId).toBe('bench');
  });

  it('does not flag when improvement exceeds threshold', () => {
    const improving = [
      point('squat', '2024-01-01T10:00:00Z', 100),
      point('squat', '2024-01-08T10:00:00Z', 103),
      point('squat', '2024-01-15T10:00:00Z', 106),
      point('squat', '2024-01-22T10:00:00Z', 110),
    ];
    const signals = detectPlateaus(improving);
    expect(signals[0].isPlateauing).toBe(false);
    expect(signals[0].e1rmChangePct).toBeGreaterThanOrEqual(2);
  });

  it('flags declining e1RM as plateauing (signed change < threshold)', () => {
    const declining = [
      point('dl', '2024-01-01T10:00:00Z', 150),
      point('dl', '2024-01-08T10:00:00Z', 148),
      point('dl', '2024-01-15T10:00:00Z', 147),
      point('dl', '2024-01-22T10:00:00Z', 146),
    ];
    const [signal] = detectPlateaus(declining);
    expect(signal.isPlateauing).toBe(true);
    expect(signal.e1rmChangePct).toBeLessThan(0);
  });

  it('uses the last minSessions sessions when more data exists', () => {
    const extraSessions = [
      // Early sessions show large improvement (should NOT be in window)
      point('bench', '2023-10-01T10:00:00Z', 50),
      point('bench', '2023-11-01T10:00:00Z', 70),
      // Recent sessions are flat
      ...BENCH_SESSIONS,
    ];
    const [signal] = detectPlateaus(extraSessions, { minSessions: 4 });
    // Window is the last 4 → BENCH_SESSIONS (100→101 = 1%)
    expect(signal.isPlateauing).toBe(true);
    expect(signal.sessionsAnalyzed).toBe(4);
  });

  it('handles multiple exercises independently', () => {
    const series = [
      ...BENCH_SESSIONS,
      point('squat', '2024-01-01T10:00:00Z', 100),
      point('squat', '2024-01-08T10:00:00Z', 105),
      point('squat', '2024-01-15T10:00:00Z', 110),
      point('squat', '2024-01-22T10:00:00Z', 115),
    ];
    const signals = detectPlateaus(series);
    const bench = signals.find((s) => s.exerciseId === 'bench');
    const squat = signals.find((s) => s.exerciseId === 'squat');
    expect(bench?.isPlateauing).toBe(true);
    expect(squat?.isPlateauing).toBe(false);
  });

  it('respects custom minSessions', () => {
    const series = [
      point('bench', '2024-01-01T10:00:00Z', 100),
      point('bench', '2024-01-08T10:00:00Z', 101),
    ];
    // minSessions=2 → enough data
    const [signal] = detectPlateaus(series, { minSessions: 2 });
    expect(signal).toBeDefined();
    expect(signal.isPlateauing).toBe(true);
  });

  it('respects custom flatThresholdPct', () => {
    // 100 → 104 = 4% change
    const series = [
      point('bench', '2024-01-01T10:00:00Z', 100),
      point('bench', '2024-01-08T10:00:00Z', 101),
      point('bench', '2024-01-15T10:00:00Z', 103),
      point('bench', '2024-01-22T10:00:00Z', 104),
    ];
    // Default 2% → not plateau (4% > 2%)
    expect(detectPlateaus(series)[0].isPlateauing).toBe(false);
    // Custom 5% → is plateau (4% < 5%)
    expect(detectPlateaus(series, { flatThresholdPct: 5 })[0].isPlateauing).toBe(true);
  });

  it('handles sparse data — exercise present in only some of the series dates', () => {
    const series = [
      point('rare', '2024-01-01T10:00:00Z', 80),
      point('rare', '2024-01-29T10:00:00Z', 80.5), // big gap
      point('bench', '2024-01-01T10:00:00Z', 100),
      point('bench', '2024-01-08T10:00:00Z', 101),
      point('bench', '2024-01-15T10:00:00Z', 101),
      point('bench', '2024-01-22T10:00:00Z', 101),
    ];
    const signals = detectPlateaus(series, { minSessions: 4 });
    // 'rare' has only 2 sessions → skipped
    expect(signals.find((s) => s.exerciseId === 'rare')).toBeUndefined();
    // 'bench' has 4 sessions → included
    expect(signals.find((s) => s.exerciseId === 'bench')).toBeDefined();
  });

  it('sets sessionsAnalyzed to minSessions regardless of total points', () => {
    const extra = [
      point('bench', '2023-12-01T10:00:00Z', 90),
      point('bench', '2023-12-08T10:00:00Z', 92),
      ...BENCH_SESSIONS, // 4 more
    ];
    const [signal] = detectPlateaus(extra, { minSessions: 4 });
    expect(signal.sessionsAnalyzed).toBe(4);
  });

  it('flags plateau when top-set weight stalls even though e1RM exceeds threshold', () => {
    // e1RM rises >2% (more reps at same weight) but top-set weight never increases
    const series = [
      point('bench', '2024-01-01T10:00:00Z', 100, 'bench', 100, 1),  // 100 kg × 1
      point('bench', '2024-01-08T10:00:00Z', 110, 'bench', 100, 3),  // 100 kg × 3 → e1RM up
      point('bench', '2024-01-15T10:00:00Z', 120, 'bench', 100, 6),  // 100 kg × 6 → e1RM up
      point('bench', '2024-01-22T10:00:00Z', 133, 'bench', 100, 10), // 100 kg × 10 → e1RM +33%
    ];
    const [signal] = detectPlateaus(series, { minSessions: 4 });
    // e1rmChangePct ≈ 33% which is above flatThreshold=2%, but top-set weight is flat
    expect(signal.topSetImproving).toBe(false);
    expect(signal.isPlateauing).toBe(true);
  });

  it('does not flag when both e1RM and top-set weight improve', () => {
    const series = [
      point('squat', '2024-01-01T10:00:00Z', 100, 'squat', 100, 5),
      point('squat', '2024-01-08T10:00:00Z', 105, 'squat', 103, 5),
      point('squat', '2024-01-15T10:00:00Z', 110, 'squat', 107, 5),
      point('squat', '2024-01-22T10:00:00Z', 116, 'squat', 112, 5),
    ];
    const [signal] = detectPlateaus(series, { minSessions: 4 });
    expect(signal.topSetImproving).toBe(true);
    expect(signal.isPlateauing).toBe(false);
  });
});
