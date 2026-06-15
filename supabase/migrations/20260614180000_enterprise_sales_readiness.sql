-- Enterprise sales readiness: leads, demos, pipeline, email sequences

CREATE TABLE IF NOT EXISTS public.enterprise_leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  domain TEXT,
  company_size TEXT,
  security_needs JSONB DEFAULT '[]',
  message TEXT,
  lead_score INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','qualified','closed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enterprise_leads_status ON public.enterprise_leads(status);
CREATE INDEX IF NOT EXISTS idx_enterprise_leads_email ON public.enterprise_leads(email);

CREATE TABLE IF NOT EXISTS public.enterprise_demos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.enterprise_leads(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  name TEXT,
  scheduled_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','no_show')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enterprise_demos_scheduled ON public.enterprise_demos(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_enterprise_demos_lead ON public.enterprise_demos(lead_id);

CREATE TABLE IF NOT EXISTS public.enterprise_pipeline (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.enterprise_leads(id) ON DELETE CASCADE,
  stage TEXT NOT NULL DEFAULT 'new' CHECK (stage IN ('new','qualified','demo','proposal','closed')),
  owner_email TEXT NOT NULL DEFAULT 'avanbailey@gmail.com',
  value_estimate NUMERIC,
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enterprise_pipeline_stage ON public.enterprise_pipeline(stage);
CREATE INDEX IF NOT EXISTS idx_enterprise_pipeline_lead ON public.enterprise_pipeline(lead_id);

CREATE TABLE IF NOT EXISTS public.enterprise_email_sequences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.enterprise_leads(id) ON DELETE CASCADE,
  sequence_step INTEGER NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent BOOLEAN DEFAULT FALSE,
  template TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enterprise_email_sequences_due ON public.enterprise_email_sequences(scheduled_for, sent);

ALTER TABLE public.enterprise_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_demos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_pipeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_email_sequences ENABLE ROW LEVEL SECURITY;

-- No public policies — all access via service role API routes
