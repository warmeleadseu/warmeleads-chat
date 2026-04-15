-- Demo portal: add demo_mode to customers and seed template demo leads

-- 1. Add demo_mode column to customers (false for existing, true for new signups)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS demo_mode boolean NOT NULL DEFAULT false;

-- 2. Extend bron CHECK constraint to allow 'demo'
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_bron_check;
ALTER TABLE leads ADD CONSTRAINT leads_bron_check CHECK (bron IN ('handmatig', 'excel_import', 'zapier', 'demo'));

-- 3. Extend lead_assignments source to allow 'demo'
-- The source column was added in 042 with default 'distribution', no CHECK constraint exists

-- 4. Insert template demo leads (shared pool, customer_id = NULL)
INSERT INTO leads (id, branch, customer_id, naam_klant, email, telefoonnummer, postcode, huisnummer, plaatsnaam, provincie, wervingsdatum, status, notities, bron, lat, lng)
VALUES
  -- Thuisbatterij (5 leads)
  ('d0000000-0001-4000-a000-000000000001', 'thuisbatterij', NULL, 'Jan de Vries', 'jan.devries@email.nl', '0612345001', '5611AB', '12', 'Eindhoven', 'Noord-Brabant', CURRENT_DATE - INTERVAL '2 days', 'nieuw', NULL, 'demo', 51.4416, 5.4697),
  ('d0000000-0001-4000-a000-000000000002', 'thuisbatterij', NULL, 'Maria van den Berg', 'maria.vdberg@email.nl', '0612345002', '3511CE', '45', 'Utrecht', 'Utrecht', CURRENT_DATE - INTERVAL '5 days', 'nieuw', NULL, 'demo', 52.0907, 5.1214),
  ('d0000000-0001-4000-a000-000000000003', 'thuisbatterij', NULL, 'Peter Bakker', 'peter.bakker@email.nl', '0612345003', '2011VK', '8', 'Haarlem', 'Noord-Holland', CURRENT_DATE - INTERVAL '7 days', 'nieuw', NULL, 'demo', 52.3813, 4.6363),
  ('d0000000-0001-4000-a000-000000000004', 'thuisbatterij', NULL, 'Anne Jansen', 'anne.jansen@email.nl', '0612345004', '6811GR', '22', 'Arnhem', 'Gelderland', CURRENT_DATE - INTERVAL '10 days', 'nieuw', NULL, 'demo', 51.9851, 5.8987),

  -- Zonnepanelen (4 leads)
  ('d0000000-0002-4000-a000-000000000001', 'zonnepanelen', NULL, 'Kees Smit', 'kees.smit@email.nl', '0612345011', '7511JE', '3', 'Enschede', 'Overijssel', CURRENT_DATE - INTERVAL '1 day', 'nieuw', NULL, 'demo', 52.2215, 6.8937),
  ('d0000000-0002-4000-a000-000000000002', 'zonnepanelen', NULL, 'Linda Visser', 'linda.visser@email.nl', '0612345012', '9711NR', '67', 'Groningen', 'Groningen', CURRENT_DATE - INTERVAL '4 days', 'nieuw', NULL, 'demo', 53.2194, 6.5665),
  ('d0000000-0002-4000-a000-000000000003', 'zonnepanelen', NULL, 'Tom Mulder', 'tom.mulder@email.nl', '0612345013', '4811DK', '15', 'Breda', 'Noord-Brabant', CURRENT_DATE - INTERVAL '6 days', 'nieuw', NULL, 'demo', 51.5719, 4.7683),
  ('d0000000-0002-4000-a000-000000000004', 'zonnepanelen', NULL, 'Sophie de Groot', 'sophie.degroot@email.nl', '0612345014', '1011AB', '31', 'Amsterdam', 'Noord-Holland', CURRENT_DATE - INTERVAL '9 days', 'nieuw', NULL, 'demo', 52.3676, 4.9041),

  -- Warmtepomp (4 leads)
  ('d0000000-0003-4000-a000-000000000001', 'warmtepomp', NULL, 'Erik Hendriks', 'erik.hendriks@email.nl', '0612345021', '5038EA', '9', 'Tilburg', 'Noord-Brabant', CURRENT_DATE - INTERVAL '2 days', 'nieuw', NULL, 'demo', 51.5555, 5.0913),
  ('d0000000-0003-4000-a000-000000000002', 'warmtepomp', NULL, 'Maaike Bos', 'maaike.bos@email.nl', '0612345022', '8011PA', '28', 'Zwolle', 'Overijssel', CURRENT_DATE - INTERVAL '5 days', 'nieuw', NULL, 'demo', 52.5168, 6.0830),
  ('d0000000-0003-4000-a000-000000000003', 'warmtepomp', NULL, 'Willem van Dijk', 'willem.vdijk@email.nl', '0612345023', '6511PP', '41', 'Nijmegen', 'Gelderland', CURRENT_DATE - INTERVAL '8 days', 'nieuw', NULL, 'demo', 51.8426, 5.8524),
  ('d0000000-0003-4000-a000-000000000004', 'warmtepomp', NULL, 'Sanne Vermeer', 'sanne.vermeer@email.nl', '0612345024', '2312AB', '5', 'Leiden', 'Zuid-Holland', CURRENT_DATE - INTERVAL '11 days', 'nieuw', NULL, 'demo', 52.1601, 4.4970),

  -- Airco (4 leads)
  ('d0000000-0004-4000-a000-000000000001', 'airco', NULL, 'Rob Dekker', 'rob.dekker@email.nl', '0612345031', '3013AL', '17', 'Rotterdam', 'Zuid-Holland', CURRENT_DATE - INTERVAL '1 day', 'nieuw', NULL, 'demo', 51.9225, 4.4792),
  ('d0000000-0004-4000-a000-000000000002', 'airco', NULL, 'Eva Peters', 'eva.peters@email.nl', '0612345032', '2514JR', '52', 'Den Haag', 'Zuid-Holland', CURRENT_DATE - INTERVAL '3 days', 'nieuw', NULL, 'demo', 52.0705, 4.3007),
  ('d0000000-0004-4000-a000-000000000003', 'airco', NULL, 'Daan van Leeuwen', 'daan.vleeuwen@email.nl', '0612345033', '6212AB', '7', 'Maastricht', 'Limburg', CURRENT_DATE - INTERVAL '6 days', 'nieuw', NULL, 'demo', 50.8514, 5.6910),
  ('d0000000-0004-4000-a000-000000000004', 'airco', NULL, 'Lisa Meijer', 'lisa.meijer@email.nl', '0612345034', '1811KH', '33', 'Alkmaar', 'Noord-Holland', CURRENT_DATE - INTERVAL '9 days', 'nieuw', NULL, 'demo', 52.6324, 4.7534),

  -- Zakelijke Batterij (4 leads)
  ('d0000000-0005-4000-a000-000000000001', 'zakelijke_batterij', NULL, 'Martijn Scholten', 'martijn@scholten-bv.nl', '0612345041', '5617BD', '120', 'Eindhoven', 'Noord-Brabant', CURRENT_DATE - INTERVAL '2 days', 'nieuw', NULL, 'demo', 51.4484, 5.4586),
  ('d0000000-0005-4000-a000-000000000002', 'zakelijke_batterij', NULL, 'Ingrid van der Pol', 'ingrid@vanderpol-logistics.nl', '0612345042', '3012KJ', '88', 'Rotterdam', 'Zuid-Holland', CURRENT_DATE - INTERVAL '4 days', 'nieuw', NULL, 'demo', 51.9244, 4.4777),
  ('d0000000-0005-4000-a000-000000000003', 'zakelijke_batterij', NULL, 'Jeroen Willems', 'jeroen@willems-techniek.nl', '0612345043', '5211DL', '14', 's-Hertogenbosch', 'Noord-Brabant', CURRENT_DATE - INTERVAL '7 days', 'nieuw', NULL, 'demo', 51.6978, 5.3037),
  ('d0000000-0005-4000-a000-000000000004', 'zakelijke_batterij', NULL, 'Nicole Brouwer', 'nicole@brouwer-vastgoed.nl', '0612345044', '1012JS', '201', 'Amsterdam', 'Noord-Holland', CURRENT_DATE - INTERVAL '10 days', 'nieuw', NULL, 'demo', 52.3702, 4.8952),

  -- Financial Lease (4 leads)
  ('d0000000-0006-4000-a000-000000000001', 'financial_lease', NULL, 'Stefan Kuiper', 'stefan@kuiper-mkb.nl', '0612345051', '3542AD', '56', 'Utrecht', 'Utrecht', CURRENT_DATE - INTERVAL '3 days', 'nieuw', NULL, 'demo', 52.0894, 5.0963),
  ('d0000000-0006-4000-a000-000000000002', 'financial_lease', NULL, 'Monique Vos', 'monique@vos-finance.nl', '0612345052', '5612AJ', '29', 'Eindhoven', 'Noord-Brabant', CURRENT_DATE - INTERVAL '5 days', 'nieuw', NULL, 'demo', 51.4393, 5.4785),
  ('d0000000-0006-4000-a000-000000000003', 'financial_lease', NULL, 'Patrick de Jong', 'patrick@dejong-transport.nl', '0612345053', '7411HP', '11', 'Deventer', 'Overijssel', CURRENT_DATE - INTERVAL '8 days', 'nieuw', NULL, 'demo', 52.2512, 6.1602),
  ('d0000000-0006-4000-a000-000000000004', 'financial_lease', NULL, 'Caroline Kok', 'caroline@kok-advies.nl', '0612345054', '6811HA', '38', 'Arnhem', 'Gelderland', CURRENT_DATE - INTERVAL '12 days', 'nieuw', NULL, 'demo', 51.9836, 5.9108),

  -- Maatwerk (4 leads)
  ('d0000000-0007-4000-a000-000000000001', 'maatwerk', NULL, 'Henk Dijkstra', 'henk.dijkstra@email.nl', '0612345061', '9711LM', '4', 'Groningen', 'Groningen', CURRENT_DATE - INTERVAL '1 day', 'nieuw', NULL, 'demo', 53.2194, 6.5665),
  ('d0000000-0007-4000-a000-000000000002', 'maatwerk', NULL, 'Femke van Vliet', 'femke.vvliet@email.nl', '0612345062', '5616GH', '19', 'Eindhoven', 'Noord-Brabant', CURRENT_DATE - INTERVAL '4 days', 'nieuw', NULL, 'demo', 51.4381, 5.4752),
  ('d0000000-0007-4000-a000-000000000003', 'maatwerk', NULL, 'Bart Koning', 'bart.koning@email.nl', '0612345063', '2511BT', '61', 'Den Haag', 'Zuid-Holland', CURRENT_DATE - INTERVAL '7 days', 'nieuw', NULL, 'demo', 52.0799, 4.3113),
  ('d0000000-0007-4000-a000-000000000004', 'maatwerk', NULL, 'Anouk Bosman', 'anouk.bosman@email.nl', '0612345064', '3511LX', '23', 'Utrecht', 'Utrecht', CURRENT_DATE - INTERVAL '10 days', 'nieuw', NULL, 'demo', 52.0893, 5.1101)

ON CONFLICT (id) DO NOTHING;

-- 5. Set existing self-service signup customers to demo_mode if they have no batches yet
-- (Optional: skip this to only affect NEW signups going forward)
