-- Hidden QA customer simulation flag (internal testing only).
-- Do not expose is_qa_account in customer UI except for flagged accounts.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_qa_account BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS qa_simulated_plan TEXT
    CHECK (qa_simulated_plan IS NULL OR qa_simulated_plan IN ('pro', 'growth', 'agency'));

COMMENT ON COLUMN public.profiles.is_qa_account IS
  'Internal QA simulation account — simulates paid subscription without Stripe. Hidden from normal users.';

COMMENT ON COLUMN public.profiles.qa_simulated_plan IS
  'When is_qa_account=true, feature gates use this plan (pro/growth/agency). Default agency when null.';

-- Flag the internal QA mailbox when it exists (no error if absent).
DO $$
DECLARE
  v_user_id UUID;
  v_org_id UUID;
  v_email TEXT;
BEGIN
  SELECT u.id, u.email INTO v_user_id, v_email
  FROM auth.users u
  WHERE lower(u.email) = lower('test@gmail.com')
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.profiles
  SET
    is_qa_account = true,
    qa_simulated_plan = COALESCE(qa_simulated_plan, 'agency'),
    updated_at = NOW()
  WHERE id = v_user_id;

  SELECT COALESCE(
    p.default_org_id,
    (SELECT om.org_id FROM public.organization_members om WHERE om.user_id = v_user_id ORDER BY om.created_at ASC LIMIT 1)
  )
  INTO v_org_id
  FROM public.profiles p
  WHERE p.id = v_user_id;

  IF v_org_id IS NULL THEN
    INSERT INTO public.organizations (name, owner_id, plan, seat_limit)
    VALUES (split_part(v_email, '@', 1) || '''s Organization', v_user_id, 'free', 5)
    RETURNING id INTO v_org_id;

    INSERT INTO public.organization_members (org_id, user_id, role)
    VALUES (v_org_id, v_user_id, 'owner')
    ON CONFLICT (org_id, user_id) DO NOTHING;

    UPDATE public.profiles SET default_org_id = v_org_id WHERE id = v_user_id;
  END IF;
END $$;
