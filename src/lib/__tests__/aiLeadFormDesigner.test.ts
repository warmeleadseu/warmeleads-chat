import { describe, expect, it } from 'vitest';
import {
  AiLeadFormDraftSchema,
  AiCustomQuestionSchema,
  DEFAULT_PREFILLED_FIELDS,
  DEFAULT_PRIVACY_URL,
  __internal,
} from '../aiLeadFormDesigner';

describe('AiLeadFormDesigner · schema validatie', () => {
  it('accepteert een geldige minimale draft', () => {
    const draft = {
      name: 'Thuisbatterij NL — Hoog intent v1',
      locale: 'nl_NL',
      form_type: 'HIGHER_INTENT',
      custom_questions: [
        {
          key: 'eigen_woning',
          label: 'Heb je een eigen woning?',
          type: 'MULTIPLE_CHOICE',
          options: [
            { value: 'ja', label: 'Ja' },
            { value: 'nee', label: 'Nee' },
          ],
        },
        {
          key: 'zonnepanelen',
          label: 'Heb je zonnepanelen?',
          type: 'MULTIPLE_CHOICE',
          options: [
            { value: 'ja', label: 'Ja' },
            { value: 'gepland', label: 'Gepland binnen 6 maanden' },
            { value: 'nee', label: 'Nee' },
          ],
        },
      ],
      prefilled_fields: ['FULL_NAME', 'EMAIL', 'PHONE', 'POST_CODE'],
      thank_you_page: {
        title: 'Bedankt!',
        body: 'We nemen binnen 24 uur contact op.',
        button_type: 'VIEW_WEBSITE',
        button_text: 'Bezoek website',
        website_url: 'https://warmeleads.eu',
      },
      privacy_policy: { url: DEFAULT_PRIVACY_URL, link_text: 'Privacybeleid' },
      design_rationale: 'Eerst micro-commitment (eigen woning), dan harde kwalificatie (PV).',
    };
    expect(() => AiLeadFormDraftSchema.parse(draft)).not.toThrow();
  });

  it('weigert key in non-snake_case formaat', () => {
    const bad = AiCustomQuestionSchema.safeParse({
      key: 'Heeft Spaties',
      label: 'Test',
      type: 'SHORT_ANSWER',
    });
    expect(bad.success).toBe(false);
  });

  it('weigert MULTIPLE_CHOICE met minder dan 2 opties', () => {
    const bad = AiCustomQuestionSchema.safeParse({
      key: 'urgentie',
      label: 'Wanneer wil je dit?',
      type: 'MULTIPLE_CHOICE',
      options: [{ value: 'nu', label: 'Nu' }],
    });
    expect(bad.success).toBe(false);
  });

  it('weigert te lange formuliernaam (>60 chars)', () => {
    const tooLong = 'A'.repeat(61);
    const r = AiLeadFormDraftSchema.safeParse({
      name: tooLong,
      locale: 'nl_NL',
      form_type: 'HIGHER_INTENT',
      custom_questions: [
        { key: 'a', label: 'AAAA', type: 'SHORT_ANSWER' },
        { key: 'b', label: 'BBBB', type: 'SHORT_ANSWER' },
      ],
      prefilled_fields: ['EMAIL'],
      thank_you_page: { title: 'Yes', body: 'thanks!', button_type: 'NONE', button_text: 'OK' },
      privacy_policy: { url: 'https://warmeleads.eu/privacy', link_text: 'Privacy' },
      design_rationale: 'Genoeg uitleg om aan de minimum-eis te voldoen voor tests.',
    });
    expect(r.success).toBe(false);
  });
});

describe('AiLeadFormDesigner · constants', () => {
  it('default prefilled fields zijn NAW + postcode', () => {
    expect(DEFAULT_PREFILLED_FIELDS).toEqual(['FULL_NAME', 'EMAIL', 'PHONE', 'POST_CODE']);
  });

  it('default privacy URL wijst naar warmeleads.eu', () => {
    expect(DEFAULT_PRIVACY_URL).toBe('https://warmeleads.eu/privacy');
  });
});

describe('AiLeadFormDesigner · buildSystemPrompt', () => {
  it('bevat branche-hint voor thuisbatterij + qualifying signals', () => {
    const prompt = __internal.buildSystemPrompt({
      branch: 'thuisbatterij',
      branchName: 'Thuisbatterij',
      audience_problem: 'pieken in stroomverbruik',
      audience_motivation: 'afschaffing salderingsregeling',
    });
    expect(prompt).toContain('Thuisbatterij');
    expect(prompt).toContain('zonnepanelen');
    expect(prompt).toContain('pieken in stroomverbruik');
    expect(prompt).toContain('afschaffing salderingsregeling');
    // Best-practice regels moeten erin staan
    expect(prompt).toContain('EXACT 2-4 custom_questions');
    expect(prompt).toContain('MULTIPLE_CHOICE');
    expect(prompt).toContain('LICHT → ZWAAR');
    expect(prompt).toContain(DEFAULT_PRIVACY_URL);
  });

  it('verwerkt bestaande branch_fields keys om hergebruik te stimuleren', () => {
    const prompt = __internal.buildSystemPrompt({
      branch: 'thuisbatterij',
      existing_branch_field_keys: [
        { key: 'zonnepanelen', label: 'Zonnepanelen' },
        { key: 'stroomverbruik', label: 'Stroomverbruik' },
      ],
    });
    expect(prompt).toContain('zonnepanelen');
    expect(prompt).toContain('stroomverbruik');
    expect(prompt).toContain('HERGEBRUIK');
  });

  it('detecteert onbekende branche en valt terug op generieke defaults', () => {
    const prompt = __internal.buildSystemPrompt({ branch: 'onbekende_branche' });
    expect(prompt).toContain('Huiseigenaar 30-65');
  });
});

describe('AiLeadFormDesigner · JSON schema voor strict mode', () => {
  it('vereist 2-4 custom_questions', () => {
    const schema = __internal.LEADFORM_JSON_SCHEMA;
    const cq = schema.properties.custom_questions;
    expect(cq.minItems).toBe(2);
    expect(cq.maxItems).toBe(4);
  });

  it('locale enum bevat nl_NL + nl_BE', () => {
    const schema = __internal.LEADFORM_JSON_SCHEMA;
    const locales = schema.properties.locale.enum;
    expect(locales).toContain('nl_NL');
    expect(locales).toContain('nl_BE');
  });
});
