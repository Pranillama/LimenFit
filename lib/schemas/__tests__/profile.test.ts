import { describe, it, expect } from 'vitest';

import { profilePatchBodySchema, type ProfileDTO } from '@/lib/schemas/profile';

describe('profilePatchBodySchema', () => {
  it('accepts an empty patch is rejected (at least one field required)', () => {
    const result = profilePatchBodySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('accepts a single-field patch (firstName)', () => {
    const result = profilePatchBodySchema.safeParse({ firstName: 'Ada' });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid primaryGoal enum', () => {
    const result = profilePatchBodySchema.safeParse({ primaryGoal: 'bulking' });
    expect(result.success).toBe(false);
  });

  it('rejects weeklyTrainingFrequency below 2 or above 6', () => {
    expect(profilePatchBodySchema.safeParse({ weeklyTrainingFrequency: 1 }).success).toBe(false);
    expect(profilePatchBodySchema.safeParse({ weeklyTrainingFrequency: 7 }).success).toBe(false);
    expect(profilePatchBodySchema.safeParse({ weeklyTrainingFrequency: 4 }).success).toBe(true);
  });

  it('accepts a fully populated patch', () => {
    const body = {
      firstName: 'Ada',
      lastName: 'Lovelace',
      username: 'ada',
      heightCm: 170.5,
      startingWeightKg: 65,
      gender: 'prefer_not_to_say',
      primaryGoal: 'general_fitness',
      activityLevel: 'moderately_active',
      trainingExperience: 'intermediate',
      weeklyTrainingFrequency: 4,
    } satisfies Partial<ProfileDTO>;
    expect(profilePatchBodySchema.safeParse(body).success).toBe(true);
  });
});
