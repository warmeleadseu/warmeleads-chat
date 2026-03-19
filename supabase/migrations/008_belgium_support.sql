-- Add country field to leads (NL or BE)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS land text DEFAULT 'NL';

-- Auto-detect country for existing leads based on postcode pattern
UPDATE leads SET land = 'BE'
WHERE postcode IS NOT NULL
  AND postcode != ''
  AND land = 'NL'
  AND postcode ~ '^\d{4}$'
  AND CAST(postcode AS integer) BETWEEN 1000 AND 9999
  AND NOT postcode ~ '^\d{4}[A-Za-z]{2}';
