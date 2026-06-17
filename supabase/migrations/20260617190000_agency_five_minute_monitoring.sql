-- Agency + owner websites: enable 5-minute monitoring cadence (hourly_monitor mode).
UPDATE public.websites w
SET
  scan_frequency = 'hourly_monitor',
  next_scan_at = NOW()
WHERE w.is_active = true
  AND (
    w.org_id IN (SELECT id FROM public.organizations WHERE plan = 'agency')
    OR w.user_id IN (SELECT id FROM public.profiles WHERE lower(email) = 'avanbailey@gmail.com')
  );
