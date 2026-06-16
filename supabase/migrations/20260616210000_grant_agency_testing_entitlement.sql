-- Internal testing entitlement: Agency tier via organization_subscriptions (no Stripe, no code gates).
-- Target user resolved by email lookup only in this data migration.

ALTER TABLE public.organization_subscriptions
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
DECLARE
  v_user_id UUID;
  v_org_id UUID;
  v_email TEXT;
  v_granted_at TIMESTAMPTZ := NOW();
  v_period_end TIMESTAMPTZ := NOW() + INTERVAL '1 year';
BEGIN
  SELECT u.id, u.email
  INTO v_user_id, v_email
  FROM auth.users u
  WHERE lower(u.email) = lower('avanbailey711@gmail.com')
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Target user not found for testing entitlement grant';
  END IF;

  SELECT COALESCE(
    p.default_org_id,
    (
      SELECT om.org_id
      FROM public.organization_members om
      WHERE om.user_id = v_user_id
      ORDER BY om.created_at ASC
      LIMIT 1
    )
  )
  INTO v_org_id
  FROM public.profiles p
  WHERE p.id = v_user_id;

  IF v_org_id IS NULL THEN
    INSERT INTO public.organizations (name, owner_id, plan, seat_limit)
    VALUES (
      split_part(v_email, '@', 1) || '''s Organization',
      v_user_id,
      'agency',
      100
    )
    RETURNING id INTO v_org_id;
  END IF;

  INSERT INTO public.organization_members (org_id, user_id, role)
  VALUES (v_org_id, v_user_id, 'owner')
  ON CONFLICT (org_id, user_id) DO UPDATE
  SET role = 'owner';

  UPDATE public.profiles
  SET
    default_org_id = v_org_id,
    plan = 'agency',
    subscription_status = 'active',
    updated_at = v_granted_at
  WHERE id = v_user_id;

  UPDATE public.websites
  SET org_id = v_org_id
  WHERE user_id = v_user_id
    AND org_id IS NULL;

  INSERT INTO public.organization_subscriptions (
    org_id,
    plan,
    status,
    current_period_end,
    metadata,
    updated_at
  )
  VALUES (
    v_org_id,
    'agency',
    'active',
    v_period_end,
    jsonb_build_object(
      'testing', true,
      'note', 'internal agency test access',
      'granted_at', v_granted_at
    ),
    v_granted_at
  )
  ON CONFLICT (org_id) DO UPDATE
  SET
    plan = 'agency',
    status = 'active',
    current_period_end = EXCLUDED.current_period_end,
    metadata = EXCLUDED.metadata,
    updated_at = EXCLUDED.updated_at;

  UPDATE public.organizations
  SET plan = 'agency', seat_limit = 100
  WHERE id = v_org_id;

  INSERT INTO public.subscriptions (user_id, plan, status, current_period_end, updated_at)
  VALUES (v_user_id, 'agency', 'active', v_period_end, v_granted_at)
  ON CONFLICT (user_id) DO UPDATE
  SET
    plan = 'agency',
    status = 'active',
    current_period_end = EXCLUDED.current_period_end,
    updated_at = EXCLUDED.updated_at;
END $$;
