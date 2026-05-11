-- Mail-Compose: CC/BCC ondersteuning voor uitgaande mails.
--
-- email_log krijgt twee text[]-kolommen zodat we per verzonden mail kunnen
-- bewaren wie er in cc / bcc stond. Dat is nodig voor:
--   - Audit-trail (wie kreeg een kopie?).
--   - De mail-historie weergave in het CRM-drawer.
--   - Reply-handling later (we kennen alle deelnemers van de conversatie).

ALTER TABLE email_log
  ADD COLUMN IF NOT EXISTS cc_emails text[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bcc_emails text[] DEFAULT NULL;

-- Lichtgewicht index om logs te vinden waar een specifiek adres in cc/bcc stond.
CREATE INDEX IF NOT EXISTS idx_email_log_cc_emails ON email_log USING gin (cc_emails);
CREATE INDEX IF NOT EXISTS idx_email_log_bcc_emails ON email_log USING gin (bcc_emails);
