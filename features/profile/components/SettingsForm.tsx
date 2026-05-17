'use client';

import * as React from 'react';

import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  selectRestTimerDefaultSeconds,
  selectWeightUnit,
} from '@/features/workout/store/selectors';
import { useActiveWorkoutStore } from '@/features/workout/store/useActiveWorkoutStore';
import type { WeightUnit } from '@/features/workout/store/types';

import { useUpdateSettingsMutation } from '../hooks/useUpdateSettingsMutation';

export function SettingsForm() {
  const mutation = useUpdateSettingsMutation();
  const weightUnit = useActiveWorkoutStore(selectWeightUnit);
  const restTimerDefaultSeconds = useActiveWorkoutStore(selectRestTimerDefaultSeconds);

  const [restDraft, setRestDraft] = React.useState(String(restTimerDefaultSeconds));
  const [restInvalid, setRestInvalid] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync draft from store after optimistic rollback or server normalization.
  React.useEffect(() => {
    setRestDraft(String(restTimerDefaultSeconds));
    setRestInvalid(false);
  }, [restTimerDefaultSeconds]);

  React.useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  function handleWeightUnitChange(value: string) {
    mutation.mutate({ weightUnit: value as WeightUnit });
  }

  function handleRestChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    setRestDraft(raw);

    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const n = Number(raw);
    const isValid = raw !== '' && !isNaN(n) && Number.isInteger(n) && n >= 0 && n <= 600;
    setRestInvalid(!isValid);

    if (isValid) {
      timerRef.current = setTimeout(() => {
        mutation.mutate({ restTimerDefaultSeconds: n });
        timerRef.current = null;
      }, 400);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <label htmlFor="weight-unit" className="text-sm font-medium leading-none">
          Weight unit
        </label>
        <Tabs value={weightUnit} onValueChange={handleWeightUnitChange}>
          <TabsList id="weight-unit">
            <TabsTrigger value="lbs">lbs</TabsTrigger>
            <TabsTrigger value="kg">kg</TabsTrigger>
          </TabsList>
        </Tabs>
        <p className="text-xs text-muted-foreground">Used as the default for new sets.</p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="rest-timer" className="text-sm font-medium leading-none">
          Default rest timer
        </label>
        <div className="flex items-center gap-2">
          <Input
            id="rest-timer"
            type="number"
            inputMode="numeric"
            min={0}
            max={600}
            step={5}
            value={restDraft}
            onChange={handleRestChange}
            aria-invalid={restInvalid ? true : undefined}
            className="w-24"
          />
          <span className="text-sm text-muted-foreground">seconds</span>
        </div>
        <p className="text-xs text-muted-foreground">Used when starting a new rest timer.</p>
      </div>
    </div>
  );
}
