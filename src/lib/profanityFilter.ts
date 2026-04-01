/**
 * Profanity filter for incoming leads.
 * Blocks leads containing swear words in Dutch and English.
 * Uses whole-word matching to avoid false positives on names like "Hoernaert".
 */

const PROFANITY_NL = [
  'kanker', 'kut', 'hoer', 'lul', 'tering', 'tyfus', 'klootzak',
  'mongool', 'debiel', 'achterlijk', 'godverdomme', 'godver', 'kutwijf',
  'teringlijer', 'kankerlijer', 'kankerjoch', 'kutjoch', 'trut', 'slet',
  'mietje', 'flikker', 'homo', 'sukkel', 'eikel', 'reet', 'pik', 'neuk',
  'neuken', 'oprotten', 'opzouten', 'donder op', 'pleur op', 'pleurt op',
  'sodemieter op', 'tyf op', 'opflikkeren', 'opkankeren', 'oppleuren',
  'optyfen', 'kankerhoer', 'kankerslet', 'kuthoer', 'teringhoer',
  'kankerzooi', 'kutzooi', 'tyfuszooi', 'kankermongool', 'kutmongool',
  'kankerlijer', 'teringlijer', 'tyfuslijer', 'klere', 'klerezooi',
  'klerelijer', 'pokke', 'pokkezooi', 'pokkelijer',
];

const PROFANITY_EN = [
  'fuck', 'fucking', 'fucker', 'fucked', 'motherfucker', 'shit', 'shitty',
  'bullshit', 'asshole', 'bitch', 'bastard', 'dick', 'dickhead', 'pussy',
  'cunt', 'whore', 'slut', 'nigger', 'nigga', 'faggot', 'retard',
  'retarded', 'dumbass', 'jackass', 'piss off', 'screw you',
];

const LEET_MAP: Record<string, string> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's',
};

const ALL_WORDS = [...PROFANITY_NL, ...PROFANITY_EN];

function deLeet(text: string): string {
  return text.replace(/[0134 57@$]/g, ch => LEET_MAP[ch] || ch);
}

function containsProfanityInText(text: string): string | null {
  if (!text || text.trim().length === 0) return null;

  const lower = text.toLowerCase();
  const deleeted = deLeet(lower);

  for (const word of ALL_WORDS) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|[\\s,;.!?()\\[\\]{}"'\\-_/])${escaped}(?:$|[\\s,;.!?()\\[\\]{}"'\\-_/])`, 'i');

    if (regex.test(` ${lower} `) || regex.test(` ${deleeted} `)) {
      return word;
    }
  }

  return null;
}

export interface ProfanityResult {
  blocked: boolean;
  word?: string;
  field?: string;
}

/**
 * Check a lead object for profanity.
 * Returns { blocked: false } if clean, or { blocked: true, word, field } if profanity found.
 */
export function checkLeadProfanity(lead: Record<string, unknown>): ProfanityResult {
  const fieldsToCheck: [string, unknown][] = [
    ['naam_klant', lead.naam_klant],
    ['email', typeof lead.email === 'string' ? lead.email.split('@')[0] : ''],
    ['notities', lead.notities],
  ];

  if (lead.custom_fields && typeof lead.custom_fields === 'object') {
    for (const [k, v] of Object.entries(lead.custom_fields as Record<string, unknown>)) {
      if (typeof v === 'string') fieldsToCheck.push([`custom_fields.${k}`, v]);
    }
  }

  for (const [field, value] of fieldsToCheck) {
    if (typeof value !== 'string' || value.trim().length === 0) continue;
    const found = containsProfanityInText(value);
    if (found) return { blocked: true, word: found, field };
  }

  return { blocked: false };
}
