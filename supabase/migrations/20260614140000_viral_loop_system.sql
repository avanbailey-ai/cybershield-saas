-- Viral loop system: shareable scans, referrals, viral events

-- Phase 1: Share fields on scan_reports
ALTER TABLE public.scan_reports ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE;
ALTER TABLE public.scan_reports ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;
ALTER TABLE public.scan_reports ADD COLUMN IF NOT EXISTS share_approved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_scan_reports_share_token ON public.scan_reports(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scan_reports_public ON public.scan_reports(is_public) WHERE is_public = TRUE;

-- Phase 2: Referrals
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  referral_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'clicked' CHECK (status IN ('clicked','signed_up','converted')),
  referrer_ip TEXT,
  referred_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  converted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_referrals_code ON public.referrals(referral_code) WHERE referred_user_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals(status);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by_code TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS viral_score INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bonus_scans INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pro_unlock_until TIMESTAMPTZ;

-- Phase 6: Viral events
CREATE TABLE IF NOT EXISTS public.viral_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  event_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_viral_events_type ON public.viral_events(event_type);
CREATE INDEX IF NOT EXISTS idx_viral_events_user ON public.viral_events(user_id);
CREATE INDEX IF NOT EXISTS idx_viral_events_created ON public.viral_events(created_at);

-- RLS
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viral_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own referrals as referrer" ON public.referrals
  FOR SELECT TO authenticated
  USING (referrer_user_id = auth.uid());

CREATE POLICY "Service role full access referrals" ON public.referrals
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Anon insert referral clicks" ON public.referrals
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Authenticated insert referral clicks" ON public.referrals
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Anon insert viral events" ON public.viral_events
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Authenticated insert viral events" ON public.viral_events
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users read own viral events" ON public.viral_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role full access viral events" ON public.viral_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);
