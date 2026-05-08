export interface HistorySetForImport {
  reps: number | null;
  set_number: number;
}

export interface HistoryExerciseForImport {
  exercise_id: string;
  position: number;
  sets: HistorySetForImport[];
}

export interface ImportedPlanWorkoutDraft {
  name: string;
  position: number;
  exercises: Array<{
    exerciseId: string;
    targetSets: number;
    targetReps: number;
    position: number;
  }>;
}

export function buildPlanWorkoutFromHistory(
  workout: { name: string | null; workout_exercises: HistoryExerciseForImport[] },
  position: number,
): ImportedPlanWorkoutDraft {
  const name = workout.name?.trim() || 'Imported workout';

  const sorted = [...workout.workout_exercises].sort((a, b) => a.position - b.position);

  // Deduplicate consecutive same-exercise_id rows: drop zero-set rows when
  // a non-empty row exists in the same consecutive run; if the run is all
  // zero-set, keep exactly one row.
  const deduped: HistoryExerciseForImport[] = [];
  for (const we of sorted) {
    const last = deduped[deduped.length - 1];
    if (last && last.exercise_id === we.exercise_id) {
      if (we.sets.length === 0) {
        // zero-set consecutive duplicate — skip
        continue;
      }
      if (last.sets.length === 0) {
        // replace the placeholder zero-set entry with the non-empty one
        deduped[deduped.length - 1] = we;
      } else {
        // both non-empty: distinct exercises, keep
        deduped.push(we);
      }
    } else {
      deduped.push(we);
    }
  }

  const exercises = deduped.map((we, idx) => {
    const sets = [...we.sets].sort((a, b) => a.set_number - b.set_number);
    const lastPerformed = [...sets].reverse().find((s) => s.reps !== null);
    const targetSets = lastPerformed !== undefined ? Math.max(1, sets.length) : 1;
    const targetReps = lastPerformed !== undefined ? lastPerformed.reps! : 0;

    return { exerciseId: we.exercise_id, targetSets, targetReps, position: idx };
  });

  return { name, position, exercises };
}
