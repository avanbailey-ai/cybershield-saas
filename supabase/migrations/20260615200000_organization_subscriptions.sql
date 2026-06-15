-- Organization-level billing: organization_subscriptions is the access-control source of truth.

CREATE TABLE IF NOT EXISTS public.organization_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'growth', 'agency', 'enterprise')),
  status TEXT NOT NULL DEFAULT 'inactive',
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_subscriptions_stripe_customer
  ON public.organization_subscriptions (stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_stripe_subscription
  ON public.organization_subscriptions (stripe_subscription_id);

ALTER TABLE public.organization_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_subscriptions_select_member ON public.organization_subscriptions;
CREATE POLICY org_subscriptions_select_member ON public.organization_subscriptions
  FOR SELECT TO authenticated
  USING (
    org_id IN (
      SELECT om.org_id FROM public.organization_members om WHERE om.user_id = auth.uid()
    )
  );

-- Seed from organizations mirror columns
INSERT INTO public.organization_subscriptions (
  org_id, stripe_customer_id, stripe_subscription_id, plan, status, updated_at
)
SELECT
  o.id,
  o.stripe_customer_id,
  o.stripe_subscription_id,
  COALESCE(o.plan, 'free'),
  CASE
    WHEN COALESCE(o.plan, 'free') IN ('pro', 'growth', 'agency', 'enterprise') THEN 'active'
    ELSE 'inactive'
  END,
  NOW()
FROM public.organizations o
ON CONFLICT (org_id) DO UPDATE SET
  stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, organization_subscriptions.stripe_customer_id),
  stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, organization_subscriptions.stripe_subscription_id),
  plan = EXCLUDED.plan,
  updated_at = NOW();

-- Migrate user subscriptions → default org (paid rows win over free seed)
INSERT INTO public.organization_subscriptions (
  org_id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_end, updated_at
)
SELECT
  p.default_org_id,
  s.stripe_customer_id,
  s.stripe_subscription_id,
  s.plan,
  s.status,
  s.current_period_end,
  NOW()
FROM public.subscriptions s
JOIN public.profiles p ON p.id = s.user_id
WHERE p.default_org_id IS NOT NULL
  AND (s.plan != 'free' OR s.status IN ('active', 'trialing'))
ON CONFLICT (org_id) DO UPDATE SET
  stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, organization_subscriptions.stripe_customer_id),
  stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, organization_subscriptions.stripe_subscription_id),
  plan = CASE
    WHEN EXCLUDED.plan != 'free' THEN EXCLUDED.plan
    ELSE organization_subscriptions.plan
  END,
  status = EXCLUDED.status,
  current_period_end = COALESCE(EXCLUDED.current_period_end, organization_subscriptions.current_period_end),
  updated_at = NOW();
