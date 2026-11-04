-- Externe omzet: beoordeling per factuur, voor de koppeling met Rompslomp.
--
-- Rompslomp bevat ook facturen die als batch al in WarmeLeads staan, of die
-- over afspraken gaan. De nachtelijke ronde stelt per factuur voor of hij
-- meetelt (`telt_mee`, met `reden`); zet een beheerder dat met de hand om, dan
-- blijft die keuze staan (`handmatig_beoordeeld`). `betaald`: alleen betaalde
-- facturen tellen; leeg bij handmatige invoer (telt dan gewoon).
--
-- Een factuurnummer is uniek per administratie: WarmeLeads.eu en Warme
-- Thuisbatterij Leads nummeren in Rompslomp elk apart.
--
-- Alleen toevoegingen; bestaande rijen tellen mee zoals ze deden.

alter table public.externe_omzet
  add column if not exists telt_mee boolean not null default true,
  add column if not exists reden text,
  add column if not exists handmatig_beoordeeld boolean not null default false,
  add column if not exists betaald boolean,
  add column if not exists administratie text;

drop index if exists public.externe_omzet_factuurnummer_uniek;
create unique index if not exists externe_omzet_factuurnummer_uniek
  on public.externe_omzet (coalesce(administratie, ''), lower(factuurnummer)) where factuurnummer is not null;
