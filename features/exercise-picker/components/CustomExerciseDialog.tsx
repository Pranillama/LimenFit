'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/sonner';
import {
  EXERCISE_CATEGORIES,
  EXERCISE_CATEGORY_OPTIONS,
  EXERCISE_EQUIPMENT,
  EXERCISE_EQUIPMENT_OPTIONS,
  type ExerciseEquipment,
} from '@/lib/exercises/catalog';
import { cn } from '@/lib/utils';

import { useCreateExerciseMutation } from '../hooks/useCreateExerciseMutation';
import type { ExerciseListItem } from '../types';

// Raw form values stored by react-hook-form (HTML selects produce strings).
// Zod transforms convert the validated output to the proper domain types.
type RawFormValues = {
  name: string;
  category: string;
  equipment: string;
};

const customExerciseSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  // '' (placeholder) is rejected by z.enum; errorMap makes the message friendly
  category: z.enum(EXERCISE_CATEGORIES, {
    errorMap: () => ({ message: 'Category is required' }),
  }),
  // '' (None option) is normalized to null before enum validation
  equipment: z.preprocess(
    (v) => (v === '' ? null : v),
    z.enum(EXERCISE_EQUIPMENT).nullable().optional(),
  ),
});

type ValidatedValues = z.output<typeof customExerciseSchema>;

export interface CustomExerciseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName: string;
  defaultEquipment?: ExerciseEquipment | null;
  onCreated: (item: ExerciseListItem) => void;
}

const fieldCn = cn(
  'flex h-9 w-full appearance-none rounded-md border border-input bg-transparent px-3 py-1',
  'text-sm shadow-sm transition-colors',
  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
  'disabled:cursor-not-allowed disabled:opacity-50',
);

export function CustomExerciseDialog({
  open,
  onOpenChange,
  defaultName,
  defaultEquipment,
  onCreated,
}: CustomExerciseDialogProps) {
  const mutation = useCreateExerciseMutation();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<RawFormValues, unknown, ValidatedValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(customExerciseSchema) as any,
    defaultValues: {
      name: defaultName,
      category: '',
      equipment: defaultEquipment ?? '',
    },
  });

  // Re-seed defaults whenever the dialog opens (each CTA click may carry different name/equipment)
  React.useEffect(() => {
    if (open) {
      reset({
        name: defaultName,
        category: '',
        equipment: defaultEquipment ?? '',
      });
    }
  }, [open, defaultName, defaultEquipment, reset]);

  const onSubmit = async (values: ValidatedValues) => {
    try {
      const item = await mutation.mutateAsync({
        name: values.name,
        category: values.category,
        equipment: values.equipment,
      });
      toast.success('Exercise created');
      onCreated(item);
      onOpenChange(false);
    } catch (err) {
      setError('root', {
        message: err instanceof Error ? err.message : 'Failed to create exercise',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideCloseButton className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New exercise</DialogTitle>
        </DialogHeader>

        <form
          id="custom-exercise-form"
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
          {/* Name */}
          <div className="space-y-1">
            <label htmlFor="ce-name" className="text-sm font-medium text-foreground">
              Name
            </label>
            <input
              id="ce-name"
              className={cn(
                fieldCn,
                'placeholder:text-muted-foreground',
                errors.name && 'border-destructive focus-visible:ring-destructive',
              )}
              placeholder="e.g. Incline Dumbbell Press"
              {...register('name')}
            />
            {errors.name && (
              <p className="mt-1 text-xs text-destructive" role="alert">
                {errors.name.message}
              </p>
            )}
          </div>

          {/* Category — required */}
          <div className="space-y-1">
            <label htmlFor="ce-category" className="text-sm font-medium text-foreground">
              Category{' '}
              <span className="text-destructive" aria-hidden="true">
                *
              </span>
            </label>
            <select
              id="ce-category"
              className={cn(
                fieldCn,
                errors.category && 'border-destructive focus-visible:ring-destructive',
              )}
              defaultValue=""
              {...register('category')}
            >
              <option value="" disabled>
                Select category
              </option>
              {EXERCISE_CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {errors.category && (
              <p className="mt-1 text-xs text-destructive" role="alert">
                {errors.category.message}
              </p>
            )}
          </div>

          {/* Equipment — optional */}
          <div className="space-y-1">
            <label htmlFor="ce-equipment" className="text-sm font-medium text-foreground">
              Equipment
            </label>
            <select
              id="ce-equipment"
              className={fieldCn}
              defaultValue={defaultEquipment ?? ''}
              {...register('equipment')}
            >
              <option value="">None</option>
              {EXERCISE_EQUIPMENT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {errors.root && (
            <p className="text-sm text-destructive" role="alert">
              {errors.root.message}
            </p>
          )}
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" form="custom-exercise-form" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
