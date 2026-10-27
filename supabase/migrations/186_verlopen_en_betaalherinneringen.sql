-- Verlopen offertes en automatische betaalherinneringen.
--
-- Aanleiding (27 okt 2026): 86 batches wachtten op betaling, waarvan 80 van
-- klanten die nooit iets betaalden (offertes uit mei-juni), en 92 open
-- facturen (EUR 97k) hoorden bij geen batch meer: wie een onbetaalde batch
-- verwijderde, liet de factuur open en betaalbaar staan.
--
-- Een batch kan nu 'expired' worden (verlopen offerte) en een factuur ook
-- ('expired' = vervallen). Niets wordt verwijderd; terugzetten kan altijd.

alter table customer_batches drop constraint if exists customer_batches_status_check;
alter table customer_batches add constraint customer_batches_status_check
  check (status in ('active', 'paused', 'completed', 'pending_payment', 'expired'));

alter table invoices drop constraint if exists invoices_status_check;
alter table invoices add constraint invoices_status_check
  check (status in ('open', 'paid', 'credit_note', 'expired'));

alter table customer_batches add column if not exists expired_at timestamptz;
alter table invoices add column if not exists expired_at timestamptz;

-- Betaalherinneringen: welke stap is verstuurd (0 = nog geen), wanneer, en of
-- ze voor deze batch aan staan.
alter table customer_batches add column if not exists betaalherinnering_stap smallint not null default 0;
alter table customer_batches add column if not exists betaalherinnering_op timestamptz;
alter table customer_batches add column if not exists betaalherinneringen boolean not null default true;
-- Vanaf wanneer de reeks telt: leeg = aanmaakdatum; na terugzetten de dag
-- van terugzetten.
alter table customer_batches add column if not exists herinnering_vanaf timestamptz;

-- Onbetaalde batches van 21 dagen en ouder doen niet mee met de automatische
-- reeks (die zou ze meteen laten verlopen): die gaan via de eenmalige
-- opschoonlijst. Jongere lopen gewoon mee vanaf hun huidige stap.
update customer_batches set betaalherinneringen = false
  where status = 'pending_payment' and created_at < now() - interval '21 days';

create index if not exists customer_batches_wacht_op_betaling_idx
  on customer_batches (created_at) where status = 'pending_payment';
