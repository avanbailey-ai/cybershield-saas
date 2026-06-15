-- ============================================================
-- CyberShield SaaS — Full Database Schema (Phase 1 + Phase 2)
-- Run this in: Supabase Dashboard > SQL Editor
-- ============================================================

-- -------------------------------------------------------
-- PROFILES
-- Mirrors the Supabase auth.users table for app-level data
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL,
  full_name   TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ,
  plan                    TEXT        NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro','growth','agency')),
  stripe_customer_id      TEXT,
  stripe_subscription_id  TEXT,
  subscription_status     TEXT        NOT NULL DEFAULT 'inactive'
);

CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles (email);

-- -------------------------------------------------------
-- WEBSITES
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.websites (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url             TEXT        NOT NULL,
  label           TEXT,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_scanned_at TIMESTAMPTZ,
  risk_score      INTEGER
);

CREATE INDEX IF NOT EXISTS websites_user_id_idx ON public.websites (user_id);

-- -------------------------------------------------------
-- SCANS
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scans (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id            UUID        NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  user_id               UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at          TIMESTAMPTZ,
  security_score        INTEGER     CHECK (security_score >= 0 AND security_score <= 100),
  ssl_valid             BOOLEAN,
  ssl_expiry_days       INTEGER,
  headers               JSONB,
  issues                JSONB       DEFAULT '[]'::jsonb,
  passed                JSONB       DEFAULT '[]'::jsonb,
  explanation           TEXT,
  vulnerabilities_count INTEGER     DEFAULT 0,
  status                TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed')),
  error_message         TEXT,
  risk_score            INTEGER,
  risk_level            TEXT,
  breakdown             JSONB       DEFAULT '[]'::jsonb,
  recommendations       JSONB       DEFAULT '[]'::jsonb,
  is_public             BOOLEAN     NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS scans_user_id_idx    ON public.scans (user_id);
CREATE INDEX IF NOT EXISTS scans_website_id_idx ON public.scans (website_id);

-- -------------------------------------------------------
-- VULNERABILITIES
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vulnerabilities (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id      UUID        NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  website_id   UUID        NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  severity     TEXT        NOT NULL CHECK (severity IN ('critical','high','medium','low','info')),
  title        TEXT        NOT NULL,
  description  TEXT        NOT NULL,
  remediation  TEXT,
  detected_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vulnerabilities_scan_id_idx ON public.vulnerabilities (scan_id);

-- -------------------------------------------------------
-- ALERTS
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.alerts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  website_id  UUID        REFERENCES public.websites(id) ON DELETE CASCADE,
  scan_id     UUID        REFERENCES public.scans(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  message     TEXT        NOT NULL,
  severity    TEXT        NOT NULL CHECK (severity IN ('critical','high','medium','low')),
  is_read     BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved    BOOLEAN     NOT NULL DEFAULT false,
  type        TEXT        DEFAULT 'general'
);

CREATE INDEX IF NOT EXISTS alerts_user_id_idx ON public.alerts (user_id);

-- -------------------------------------------------------
-- ROW LEVEL SECURITY
-- -------------------------------------------------------
ALTER TABLE public.profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.websites       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scans          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vulnerabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts         ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Websites
CREATE POLICY "websites_select_own" ON public.websites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "websites_insert_own" ON public.websites FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "websites_update_own" ON public.websites FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "websites_delete_own" ON public.websites FOR DELETE USING (auth.uid() = user_id);

-- Scans
CREATE POLICY "scans_select_own" ON public.scans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "scans_insert_own" ON public.scans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "scans_update_own" ON public.scans FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "scans_delete_own" ON public.scans FOR DELETE USING (auth.uid() = user_id);

-- Vulnerabilities
CREATE POLICY "vulns_select_own" ON public.vulnerabilities FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "vulns_insert_own" ON public.vulnerabilities FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "vulns_delete_own" ON public.vulnerabilities FOR DELETE USING (auth.uid() = user_id);

-- Alerts
CREATE POLICY "alerts_select_own" ON public.alerts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "alerts_insert_own" ON public.alerts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "alerts_update_own" ON public.alerts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "alerts_delete_own" ON public.alerts FOR DELETE USING (auth.uid() = user_id);

-- -------------------------------------------------------
-- AUTO-CREATE PROFILE ON SIGNUP
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, created_at)
  VALUES (NEW.id, NEW.email, NOW())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- -------------------------------------------------------
-- OBSERVABILITY (Layer 5)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  layer TEXT NOT NULL CHECK (layer IN ('auth','billing','scan','queue','worker','ui','api')),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  org_id UUID,
  trace_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS system_logs_type_idx ON public.system_logs(type);
CREATE INDEX IF NOT EXISTS system_logs_trace_idx ON public.system_logs(trace_id);
CREATE INDEX IF NOT EXISTS system_logs_created_idx ON public.system_logs(created_at DESC);
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS system_logs_select_own ON public.system_logs;
CREATE POLICY system_logs_select_own ON public.system_logs FOR SELECT USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id UUID NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT 'scan',
  user_id UUID,
  website_id UUID,
  scan_id UUID,
  job_id UUID,
  status TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started','completed','failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS traces_trace_id_idx ON public.traces(trace_id);
ALTER TABLE public.traces ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS traces_select_own ON public.traces;
CREATE POLICY traces_select_own ON public.traces FOR SELECT USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.trace_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id UUID NOT NULL,
  step TEXT NOT NULL,
  layer TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ok',
  duration_ms INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS trace_steps_trace_id_idx ON public.trace_steps(trace_id);
ALTER TABLE public.trace_steps ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.system_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  dimensions JSONB DEFAULT '{}'::jsonb,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS system_metrics_name_time_idx ON public.system_metrics(metric_name, recorded_at DESC);
ALTER TABLE public.system_metrics ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.scan_queue ADD COLUMN IF NOT EXISTS trace_id UUID;
