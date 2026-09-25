-- Voorkomen dat een cronronde over zichzelf heen loopt.
--
-- De verdeelronde draait elk kwartier. Duurt een ronde langer dan dat, dan
-- start de volgende terwijl de vorige nog bezig is. Twee rondes tegelijk lezen
-- dezelfde stand en delen dezelfde lead allebei uit: sinds 1 augustus kreeg 52
-- keer dezelfde lead binnen vijf seconden twee klanten. Voor de consument
-- betekent dat twee bedrijven die tegelijk bellen, precies wat de cooldown van
-- twaalf uur moet voorkomen.
--
-- Een advisory lock werkt hier niet: elke aanroep naar de database is zijn
-- eigen sessie, dus zo'n slot valt weg zodra het verzoek klaar is. Een rij met
-- een vervaltijd wel, en die overleeft ook een functie die halverwege sneuvelt.

CREATE TABLE IF NOT EXISTS cron_sloten (
  naam             text PRIMARY KEY,
  vergrendeld_tot  timestamptz NOT NULL,
  sinds            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE cron_sloten IS
  'Houdt bij welke cronronde nu loopt, zodat twee rondes niet door elkaar heen draaien.';

/**
 * Probeert het slot te pakken. Geeft true als het gelukt is.
 *
 * De vervaltijd is een noodrem: crasht een ronde zonder het slot terug te
 * geven, dan loopt het vanzelf af en gaat het werk gewoon door. Beter een
 * zeldzame dubbele ronde dan een verdeling die voorgoed stilstaat.
 */
CREATE OR REPLACE FUNCTION neem_cron_slot(p_naam text, p_minuten integer)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  gepakt text;
BEGIN
  INSERT INTO cron_sloten (naam, vergrendeld_tot, sinds)
  VALUES (p_naam, now() + make_interval(mins => p_minuten), now())
  ON CONFLICT (naam) DO UPDATE
    SET vergrendeld_tot = now() + make_interval(mins => p_minuten),
        sinds = now()
    WHERE cron_sloten.vergrendeld_tot < now()
  RETURNING naam INTO gepakt;

  RETURN gepakt IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION geef_cron_slot_terug(p_naam text)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE cron_sloten SET vergrendeld_tot = now() - interval '1 second' WHERE naam = p_naam;
$$;

COMMENT ON FUNCTION neem_cron_slot(text, integer) IS
  'Pakt het slot voor een cronronde; false als er al een ronde loopt.';
