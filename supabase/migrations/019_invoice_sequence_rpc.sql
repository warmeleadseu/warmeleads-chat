-- RPC function to get next invoice number from sequence
CREATE OR REPLACE FUNCTION nextval_invoice()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT nextval('invoice_number_seq');
$$;
