/**
 * Phone number validation for Dutch (NL) and Belgian (BE) numbers.
 * Marks suspicious/fake numbers without blocking leads.
 */

const PREMIUM_PREFIXES = ['0900', '0800', '0906', '0909'];

const KNOWN_TEST_NUMBERS = new Set([
  '0612345678',
  '0612121212',
  '0600000000',
  '0123456789',
  '9876543210',
]);

function normalize(raw: string): string {
  let n = raw.replace(/[\s\-().]/g, '');
  if (n.startsWith('+31')) n = '0' + n.slice(3);
  else if (n.startsWith('0031')) n = '0' + n.slice(4);
  else if (n.startsWith('+32')) n = '0' + n.slice(3);
  else if (n.startsWith('0032')) n = '0' + n.slice(4);
  return n;
}

function hasRepeatedDigits(n: string): boolean {
  return /(.)\1{5,}/.test(n); // 6+ identical consecutive digits
}

function isSequential(n: string): boolean {
  const digits = n.replace(/\D/g, '');
  if (digits.length < 6) return false;
  let asc = 0;
  let desc = 0;
  for (let i = 1; i < digits.length; i++) {
    const diff = parseInt(digits[i]) - parseInt(digits[i - 1]);
    if (diff === 1) { asc++; desc = 0; }
    else if (diff === -1) { desc++; asc = 0; }
    else { asc = 0; desc = 0; }
    if (asc >= 5 || desc >= 5) return true; // 6+ sequential digits
  }
  return false;
}

function isPremium(n: string): boolean {
  return PREMIUM_PREFIXES.some(p => n.startsWith(p));
}

function isValidNLFormat(n: string): boolean {
  // Mobile: 06XXXXXXXX (10 digits)
  if (/^06\d{8}$/.test(n)) return true;
  // Landline: 0[1-5,7]\d{8} (10 digits)
  if (/^0[1-57]\d{8}$/.test(n)) return true;
  return false;
}

function isValidBEFormat(n: string): boolean {
  // Mobile: 04XX XX XX XX (10 digits)
  if (/^04\d{8}$/.test(n)) return true;
  // Landline: 0[1-9]\d{7,8} (9-10 digits)
  if (/^0[1-9]\d{7,8}$/.test(n)) return true;
  return false;
}

export interface PhoneValidationResult {
  valid: boolean;
  normalized: string;
  reason?: string;
}

export function validatePhone(raw: string | null | undefined): PhoneValidationResult {
  if (!raw || raw.trim().length === 0) {
    return { valid: true, normalized: '', reason: 'empty' };
  }

  const normalized = normalize(raw.trim());
  const digitsOnly = normalized.replace(/\D/g, '');

  if (digitsOnly.length < 8) {
    return { valid: false, normalized, reason: 'te kort' };
  }

  if (digitsOnly.length > 13) {
    return { valid: false, normalized, reason: 'te lang' };
  }

  if (KNOWN_TEST_NUMBERS.has(normalized)) {
    return { valid: false, normalized, reason: 'testnummer' };
  }

  if (hasRepeatedDigits(digitsOnly)) {
    return { valid: false, normalized, reason: 'herhalende cijfers' };
  }

  if (isSequential(digitsOnly)) {
    return { valid: false, normalized, reason: 'opeenvolgende cijfers' };
  }

  if (isPremium(normalized)) {
    return { valid: false, normalized, reason: 'premium nummer' };
  }

  // Format check: if it starts with 0, validate as NL or BE
  if (normalized.startsWith('0')) {
    if (!isValidNLFormat(normalized) && !isValidBEFormat(normalized)) {
      return { valid: false, normalized, reason: 'ongeldig formaat' };
    }
  }

  return { valid: true, normalized };
}

/**
 * Validate and return phone_valid boolean for a lead object.
 */
export function isPhoneValid(phone: string | null | undefined): boolean {
  return validatePhone(phone).valid;
}
