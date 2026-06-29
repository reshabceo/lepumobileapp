-- Junction / Abbott CGM integration (self-contained)
-- Creates profiles + glucose_readings if missing, then adds Junction columns.

-- ── profiles ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    junction_user_id TEXT,
    junction_connected BOOLEAN DEFAULT false,
    terra_user_id TEXT,
    terra_connected BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS junction_user_id TEXT,
  ADD COLUMN IF NOT EXISTS junction_connected BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS terra_user_id TEXT,
  ADD COLUMN IF NOT EXISTS terra_connected BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_profiles_junction_user_id ON public.profiles(junction_user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_terra_user_id ON public.profiles(terra_user_id);

-- ── glucose_readings ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.glucose_readings (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    glucose INTEGER NOT NULL,
    trend TEXT,
    reading_timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_glucose_readings_user_id ON public.glucose_readings(user_id);
CREATE INDEX IF NOT EXISTS idx_glucose_readings_timestamp ON public.glucose_readings(reading_timestamp DESC);

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.glucose_readings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Users can view own profile'
  ) THEN
    CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT TO authenticated
    USING (id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Users can update own profile'
  ) THEN
    CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE TO authenticated
    USING (id = auth.uid()) WITH CHECK (id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Users can insert own profile'
  ) THEN
    CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT TO authenticated
    WITH CHECK (id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'glucose_readings' AND policyname = 'Users can view own glucose readings'
  ) THEN
    CREATE POLICY "Users can view own glucose readings"
    ON public.glucose_readings FOR SELECT TO authenticated
    USING (user_id = auth.uid());
  END IF;
END $$;

-- Backfill junction columns from legacy Terra columns if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'terra_user_id'
  ) THEN
    UPDATE public.profiles
    SET
      junction_user_id = COALESCE(junction_user_id, terra_user_id),
      junction_connected = COALESCE(junction_connected, terra_connected, false)
    WHERE terra_user_id IS NOT NULL;
  END IF;
END $$;

-- Realtime for live CGM dashboard updates
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.glucose_readings;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
