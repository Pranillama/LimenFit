-- LimenFit built-in strength exercise library
-- Global exercises: user_id = NULL, is_custom = false
-- No cardio rows; users may create custom cardio exercises via the API

INSERT INTO public.exercises (name, category, equipment, is_custom, user_id) VALUES
  -- chest
  ('Bench Press',                 'chest',      'barbell',    false, NULL),
  ('Incline Bench Press',         'chest',      'barbell',    false, NULL),
  ('Decline Bench Press',         'chest',      'barbell',    false, NULL),
  ('Dumbbell Chest Press',        'chest',      'dumbbell',   false, NULL),
  ('Incline Dumbbell Press',      'chest',      'dumbbell',   false, NULL),
  ('Dumbbell Flye',               'chest',      'dumbbell',   false, NULL),
  ('Cable Flye',                  'chest',      'cable',      false, NULL),
  ('Cable Crossover',             'chest',      'cable',      false, NULL),
  ('Push-Up',                     'chest',      'bodyweight', false, NULL),
  ('Pec Deck',                    'chest',      'machine',    false, NULL),

  -- back
  ('Barbell Row',                 'back',       'barbell',    false, NULL),
  ('T-Bar Row',                   'back',       'barbell',    false, NULL),
  ('Dumbbell Row',                'back',       'dumbbell',   false, NULL),
  ('Seated Cable Row',            'back',       'cable',      false, NULL),
  ('Machine Row',                 'back',       'machine',    false, NULL),
  ('Face Pull',                   'back',       'cable',      false, NULL),
  ('Inverted Row',                'back',       'bodyweight', false, NULL),

  -- lats
  ('Pull-Up',                     'lats',       'bodyweight', false, NULL),
  ('Chin-Up',                     'lats',       'bodyweight', false, NULL),
  ('Lat Pulldown',                'lats',       'cable',      false, NULL),
  ('Wide-Grip Lat Pulldown',      'lats',       'cable',      false, NULL),
  ('Straight-Arm Pulldown',       'lats',       'cable',      false, NULL),
  ('Dumbbell Pullover',           'lats',       'dumbbell',   false, NULL),

  -- shoulders
  ('Overhead Press',              'shoulders',  'barbell',    false, NULL),
  ('Push Press',                  'shoulders',  'barbell',    false, NULL),
  ('Dumbbell Shoulder Press',     'shoulders',  'dumbbell',   false, NULL),
  ('Arnold Press',                'shoulders',  'dumbbell',   false, NULL),
  ('Lateral Raise',               'shoulders',  'dumbbell',   false, NULL),
  ('Cable Lateral Raise',         'shoulders',  'cable',      false, NULL),
  ('Front Raise',                 'shoulders',  'dumbbell',   false, NULL),
  ('Rear Delt Fly',               'shoulders',  'dumbbell',   false, NULL),

  -- arms (biceps + triceps)
  ('Barbell Bicep Curl',          'arms',       'barbell',    false, NULL),
  ('Dumbbell Bicep Curl',         'arms',       'dumbbell',   false, NULL),
  ('Hammer Curl',                 'arms',       'dumbbell',   false, NULL),
  ('Concentration Curl',          'arms',       'dumbbell',   false, NULL),
  ('Cable Curl',                  'arms',       'cable',      false, NULL),
  ('Preacher Curl',               'arms',       'barbell',    false, NULL),
  ('Tricep Pushdown',             'arms',       'cable',      false, NULL),
  ('Skull Crushers',              'arms',       'barbell',    false, NULL),
  ('Overhead Tricep Extension',   'arms',       'dumbbell',   false, NULL),
  ('Tricep Kickback',             'arms',       'dumbbell',   false, NULL),
  ('Close-Grip Bench Press',      'arms',       'barbell',    false, NULL),
  ('Diamond Push-Up',             'arms',       'bodyweight', false, NULL),

  -- forearms
  ('Wrist Curl',                  'forearms',   'dumbbell',   false, NULL),
  ('Reverse Wrist Curl',          'forearms',   'dumbbell',   false, NULL),
  ('Farmer''s Carry',             'forearms',   'dumbbell',   false, NULL),
  ('Dead Hang',                   'forearms',   'bodyweight', false, NULL),

  -- legs (quads-dominant)
  ('Barbell Squat',               'legs',       'barbell',    false, NULL),
  ('Front Squat',                 'legs',       'barbell',    false, NULL),
  ('Goblet Squat',                'legs',       'kettlebell', false, NULL),
  ('Leg Press',                   'legs',       'machine',    false, NULL),
  ('Hack Squat',                  'legs',       'machine',    false, NULL),
  ('Leg Extension',               'legs',       'machine',    false, NULL),
  ('Bulgarian Split Squat',       'legs',       'dumbbell',   false, NULL),
  ('Walking Lunge',               'legs',       'dumbbell',   false, NULL),
  ('Pistol Squat',                'legs',       'bodyweight', false, NULL),

  -- hamstrings
  ('Romanian Deadlift',           'hamstrings', 'barbell',    false, NULL),
  ('Stiff-Leg Deadlift',         'hamstrings', 'barbell',    false, NULL),
  ('Lying Leg Curl',              'hamstrings', 'machine',    false, NULL),
  ('Seated Leg Curl',             'hamstrings', 'machine',    false, NULL),
  ('Nordic Hamstring Curl',       'hamstrings', 'bodyweight', false, NULL),
  ('Good Morning',                'hamstrings', 'barbell',    false, NULL),

  -- glutes
  ('Hip Thrust',                  'glutes',     'barbell',    false, NULL),
  ('Glute Bridge',                'glutes',     'bodyweight', false, NULL),
  ('Cable Kickback',              'glutes',     'cable',      false, NULL),
  ('Step-Up',                     'glutes',     'dumbbell',   false, NULL),
  ('Sumo Deadlift',               'glutes',     'barbell',    false, NULL),

  -- calves
  ('Standing Calf Raise',         'calves',     'machine',    false, NULL),
  ('Seated Calf Raise',           'calves',     'machine',    false, NULL),
  ('Dumbbell Calf Raise',         'calves',     'dumbbell',   false, NULL),
  ('Calf Press',                  'calves',     'machine',    false, NULL),

  -- core
  ('Plank',                       'core',       'bodyweight', false, NULL),
  ('Side Plank',                  'core',       'bodyweight', false, NULL),
  ('Hanging Leg Raise',           'core',       'bodyweight', false, NULL),
  ('Cable Crunch',                'core',       'cable',      false, NULL),
  ('Ab Wheel Rollout',            'core',       'bodyweight', false, NULL),
  ('Russian Twist',               'core',       'dumbbell',   false, NULL),
  ('Decline Sit-Up',              'core',       'bodyweight', false, NULL),
  ('Dragon Flag',                 'core',       'bodyweight', false, NULL),

  -- full_body
  ('Conventional Deadlift',       'full_body',  'barbell',    false, NULL),
  ('Clean and Press',             'full_body',  'barbell',    false, NULL),
  ('Kettlebell Swing',            'full_body',  'kettlebell', false, NULL),
  ('Turkish Get-Up',              'full_body',  'kettlebell', false, NULL),
  ('Thruster',                    'full_body',  'barbell',    false, NULL),
  ('Trap Bar Deadlift',           'full_body',  'barbell',    false, NULL),
  ('Snatch',                      'full_body',  'barbell',    false, NULL),
  ('Kettlebell Clean',            'full_body',  'kettlebell', false, NULL);
