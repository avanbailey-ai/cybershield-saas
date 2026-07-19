-- Performance indexes for dashboard, analytics, leaderboard, and scan queue

-- Scans: user timeline + org queries
CREATE INDEX IF NOT EXISTS idx_scans_user_started ON public.scans (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_scans_org_id ON public.scans (org_id) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scans_status ON public.scans (status);
CREATE INDEX IF NOT EXISTS idx_scans_completed ON public.scans (completed_at DESC) WHERE status = 'completed';

-- Scan queue: dedup, rate limits, worker FIFO
CREATE INDEX IF NOT EXISTS idx_scan_queue_website_status ON public.scan_queue (website_id, status);
CREATE INDEX IF NOT EXISTS idx_scan_queue_user_created ON public.scan_queue (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_queue_org_created ON public.scan_queue (org_id, created_at DESC) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scan_queue_pending ON public.scan_queue (created_at ASC) WHERE status = 'pending';

-- Profiles: signup analytics
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles (created_at DESC);

-- Websites: org-scoped lookups
CREATE INDEX IF NOT EXISTS idx_websites_org_id ON public.websites (org_id) WHERE org_id IS NOT NULL;

-- Leaderboard: top scores + domain lookup
CREATE INDEX IF NOT EXISTS idx_leaderboard_best_score ON public.leaderboard_entries (best_score DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_domain ON public.leaderboard_entries (domain);

-- Viral events: leaderboard share counts (bounded queries)
CREATE INDEX IF NOT EXISTS idx_viral_events_type_created ON public.viral_events (event_type, created_at DESC);
