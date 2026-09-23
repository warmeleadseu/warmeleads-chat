-- De leveringswachtrij geschikt maken voor restleads.
--
-- WAAROM
-- ------
-- `geplande_leadleveringen` levert via `assignLeadToBatch`, en die weigert alles
-- wat buiten het doelgebied van de klant valt. Restleads liggen daar per
-- definitie net buiten: dat is juist de reden dat ze in die lijst staan.
--
-- Zonder deze vlag zou elke ingeplande restlead twaalf uur later netjes worden
-- overgeslagen met "valt buiten het doelgebied", en zou de gebruiker voor niets
-- staan wachten op een levering die nooit komt.
--
-- Bewust een kolom per rij en geen globale instelling: het overslaan van de
-- geocontrole is een bewuste keuze per levering, niet een stand van het systeem.

ALTER TABLE geplande_leadleveringen
  ADD COLUMN IF NOT EXISTS negeer_geo boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN geplande_leadleveringen.negeer_geo IS
  'Sla de doelgebiedcontrole over bij het leveren. Alleen voor restleads, die bewust net buiten het gebied liggen. Branche en het plafond van drie klanten blijven altijd gelden.';

-- Voor het overzicht "wat staat er nog gepland" per lead.
CREATE INDEX IF NOT EXISTS idx_geplande_leveringen_lead_status
  ON geplande_leadleveringen(lead_id, status)
  WHERE status = 'gepland';
