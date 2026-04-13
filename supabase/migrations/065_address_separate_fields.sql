-- Split single address field into structured components
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS street text,
  ADD COLUMN IF NOT EXISTS house_number text,
  ADD COLUMN IF NOT EXISTS postcode text,
  ADD COLUMN IF NOT EXISTS city text;

-- Best-effort parse of existing address values
-- Pattern: "Street Nr\nPostcode City" or "Street Nr, Postcode City"
UPDATE customers
SET
  street = CASE
    WHEN address ~ E'\\n' THEN regexp_replace(split_part(address, E'\n', 1), '\\s+\\S*$', '')
    WHEN address ~ ',' THEN regexp_replace(split_part(address, ',', 1), '\\s+\\S*$', '')
    ELSE NULL
  END,
  house_number = CASE
    WHEN address ~ E'\\n' THEN (regexp_match(split_part(address, E'\n', 1), '\\s(\\S+)$'))[1]
    WHEN address ~ ',' THEN (regexp_match(split_part(address, ',', 1), '\\s(\\S+)$'))[1]
    ELSE NULL
  END,
  postcode = CASE
    WHEN address ~ E'\\n' THEN (regexp_match(split_part(address, E'\n', 2), '^\\s*(\\d{4}\\s*[A-Za-z]{2})'))[1]
    WHEN address ~ ',' THEN (regexp_match(split_part(address, ',', 2), '^\\s*(\\d{4}\\s*[A-Za-z]{2})'))[1]
    ELSE NULL
  END,
  city = CASE
    WHEN address ~ E'\\n' THEN trim(regexp_replace(split_part(address, E'\n', 2), '^\\s*\\d{4}\\s*[A-Za-z]{2}\\s*', ''))
    WHEN address ~ ',' THEN trim(regexp_replace(split_part(address, ',', 2), '^\\s*\\d{4}\\s*[A-Za-z]{2}\\s*', ''))
    ELSE NULL
  END
WHERE address IS NOT NULL AND address != '';
