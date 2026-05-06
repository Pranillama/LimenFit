import { describe, it, expect } from 'vitest';
import { buildRepeatIntent } from '../repeatWorkout';

describe('buildRepeatIntent', () => {
  it('returns a history StartIntent with mapped exerciseId objects', () => {
    const exercises = [
      { id: 'we-1', exercise_id: 'ex-squat', position: 1, sets: [] },
      { id: 'we-2', exercise_id: 'ex-bench', position: 2, sets: [] },
    ];
    const intent = buildRepeatIntent(exercises);
    expect(intent).toMatchObject({
      source: 'history',
      payload: { exercises: [{ exerciseId: 'ex-squat' }, { exerciseId: 'ex-bench' }] },
    });
  });

  it('deduplicates exercise IDs preserving first-occurrence order', () => {
    const exercises = [
      { id: 'we-1', exercise_id: 'ex-squat', position: 1, sets: [] },
      { id: 'we-2', exercise_id: 'ex-bench', position: 2, sets: [] },
      { id: 'we-3', exercise_id: 'ex-squat', position: 3, sets: [] },
    ];
    const intent = buildRepeatIntent(exercises);
    expect(intent).toMatchObject({
      source: 'history',
      payload: { exercises: [{ exerciseId: 'ex-squat' }, { exerciseId: 'ex-bench' }] },
    });
  });

  it('returns empty exercises array when workout has no exercises', () => {
    const intent = buildRepeatIntent([]);
    expect(intent).toMatchObject({ source: 'history', payload: { exercises: [] } });
  });
});
