-- Scan usage atomic check/increment + queue idempotency

CREATE OR REPLACE FUNCTION public.check_and_increment_scan_usage(
  p_user_id uuid,
  p_max_scans int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := CURRENT_DATE;
  v_used int := 0;
  v_unlimited boolean := (p_max_scans IS NULL OR p_max_scans >= 2147483647);
BEGIN
  INSERT INTO public.user_usage (user_id, date, scans_used, websites_used, updated_at)
  VALUES (p_user_id, v_today, 0, 0, NOW())
  ON CONFLICT (user_id, date) DO NOTHING;

  SELECT scans_used INTO v_used
  FROM public.user_usage
  WHERE user_id = p_user_id AND date = v_today
  FOR UPDATE;

  IF v_used IS NULL THEN
    v_used := 0;
  END IF;

  IF NOT v_unlimited AND v_used >= p_max_scans THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Daily scan limit reached',
      'scans_used', v_used,
      'remaining', 0
    );
  END IF;

  UPDATE public.user_usage
  SET scans_used = scans_used + 1,
      updated_at = NOW()
  WHERE user_id = p_user_id AND date = v_today;

  v_used := v_used + 1;

  RETURN jsonb_build_object(
    'allowed', true,
    'scans_used', v_used,
    'remaining', CASE WHEN v_unlimited THEN NULL ELSE GREATEST(0, p_max_scans - v_used) END
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_and_increment_scan_usage(uuid, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_increment_scan_usage(uuid, int) TO service_role;

ALTER TABLE public.scan_queue
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_scan_queue_idempotency_key
  ON public.scan_queue (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
