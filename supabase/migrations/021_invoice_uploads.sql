ALTER TABLE invoices ADD COLUMN IF NOT EXISTS uploaded_pdf_path text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Service role full access on invoices bucket"
  ON storage.objects FOR ALL
  USING (bucket_id = 'invoices' AND auth.role() = 'service_role');
