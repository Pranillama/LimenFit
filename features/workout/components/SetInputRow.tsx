'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { useActiveWorkoutStore } from '../store/useActiveWorkoutStore';

function lastSetSignature(set: { localId: string; weightValue?: number | null; reps?: number | null } | undefined): string {
  if (!set) return '';
  return `${set.localId}|${set.weightValue ?? ''}|${set.reps ?? ''}`;
}

interface SetInputRowProps {
  exerciseLocalId: string;
  defaultWeight: number | '';
  defaultReps: number | '';
}

export function SetInputRow({ exerciseLocalId, defaultWeight, defaultReps }: SetInputRowProps) {
  const [weight, setWeight] = React.useState<string>(
    defaultWeight === '' ? '' : String(defaultWeight),
  );
  const [reps, setReps] = React.useState<string>(
    defaultReps === '' ? '' : String(defaultReps),
  );
  const [weightInvalid, setWeightInvalid] = React.useState(false);
  const [repsInvalid, setRepsInvalid] = React.useState(false);

  const sets = useActiveWorkoutStore(
    (s) => s.exercises.find((ex) => ex.localId === exerciseLocalId)?.sets ?? [],
  );

  const prevSetsLenRef = React.useRef(sets.length);
  const prevLastSetSigRef = React.useRef(lastSetSignature(sets.at(-1)));

  React.useEffect(() => {
    const prevLen = prevSetsLenRef.current;
    const prevSig = prevLastSetSigRef.current;
    const currLen = sets.length;
    const lastSet = sets.at(-1);
    const currSig = lastSetSignature(lastSet);

    if (currLen > prevLen) {
      // Successful logSet append: keep weight, clear reps only
      setReps('');
    } else if (currSig !== prevSig) {
      // Deletion, replacement, or in-place edit of the last set
      if (lastSet) {
        setWeight(lastSet.weightValue != null ? String(lastSet.weightValue) : '');
        setReps(lastSet.reps != null ? String(lastSet.reps) : '');
      } else {
        setWeight('');
        setReps('');
      }
    }

    prevSetsLenRef.current = currLen;
    prevLastSetSigRef.current = currSig;
  }, [sets]);

  function validate(): boolean {
    const w = Number(weight);
    const r = Number(reps);
    const isWeightValid = weight !== '' && !isNaN(w) && w >= 0;
    const isRepsValid = reps !== '' && !isNaN(r) && Number.isInteger(r) && r >= 1;
    setWeightInvalid(!isWeightValid);
    setRepsInvalid(!isRepsValid);
    return isWeightValid && isRepsValid;
  }

  function handleLog() {
    if (!validate()) return;
    // TODO(T15): pull from user_settings.weight_unit
    useActiveWorkoutStore.getState().logSet(exerciseLocalId, {
      weight: Number(weight),
      reps: Number(reps),
      weightUnit: 'lbs',
    });
  }

  function handleQuickRepeat() {
    const lastSet = sets.at(-1);
    if (!lastSet) return;
    setWeight(lastSet.weightValue != null ? String(lastSet.weightValue) : '');
    setReps(lastSet.reps != null ? String(lastSet.reps) : '');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleLog();
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <Input
        type="number"
        inputMode="decimal"
        placeholder="lbs"
        value={weight}
        onChange={(e) => {
          setWeight(e.target.value);
          setWeightInvalid(false);
        }}
        onKeyDown={handleKeyDown}
        aria-invalid={weightInvalid || undefined}
        className="w-20 text-center"
      />
      <Input
        type="number"
        inputMode="decimal"
        placeholder="reps"
        value={reps}
        onChange={(e) => {
          setReps(e.target.value);
          setRepsInvalid(false);
        }}
        onKeyDown={handleKeyDown}
        aria-invalid={repsInvalid || undefined}
        className="w-20 text-center"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleQuickRepeat}
        aria-label="Quick repeat last set"
        disabled={sets.length === 0}
      >
        ↻
      </Button>
      <Button type="button" size="sm" onClick={handleLog}>
        Log
      </Button>
    </div>
  );
}
