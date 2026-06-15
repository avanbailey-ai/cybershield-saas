-- Billing: subscriptions table + RLS (profiles remains quick-read mirror)

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'growth', 'agency')),
  status TEXT NOT NULL DEFAULT 'inactive',
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id ON public.subscriptions (stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id ON public.subscriptions (stripe_subscription_id);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscriptions_select_own ON public.subscriptions;
CREATE POLICY subscriptions_select_own ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- user_usage: ensure RLS + read-only for users (writes via service role RPC)
ALTER TABLE public.user_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own usage" ON public.user_usage;
CREATE POLICY user_usage_select_own ON public.user_usage
  FOR SELECT USING (auth.uid() = user_id);

-- Backfill subscriptions from profiles mirror
INSERT INTO public.subscriptions (user_id, stripe_customer_id, stripe_subscription_id, plan, status, updated_at)
SELECT
  p.id,
  p.stripe_customer_id,
  p.stripe_subscription_id,
  COALESCE(p.plan, 'free'),
  COALESCE(p.subscription_status, 'inactive'),
  NOW()
FROM public.profiles p
ON CONFLICT (user_id) DO UPDATE SET
  stripe_customer_id = EXCLUDED.stripe_customer_id,
  stripe_subscription_id = EXCLUDED.stripe_subscription_id,
  plan = EXCLUDED.plan,
  status = EXCLUDED.status,
  updated_at = NOW();
