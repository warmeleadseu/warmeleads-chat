import { describe, expect, it } from 'vitest';
import { neiBegunIntroTemplate } from '../nei_begun_intro';
import {
  findRecipientsMissingBranchRequirement,
  listTemplates,
  templateBranchRequirement,
  renderTemplate,
} from '../index';
import type { RenderCtx } from '../types';

const baseCtx: RenderCtx = {
  recipient: {
    type: 'prospect',
    id: 'prospect-1',
    email: 'voorbeeld@nij-begun-installateur.nl',
    name: 'Hendrik de Vries',
    firstName: 'Hendrik',
    companyName: 'De Vries Isolatie',
    branches: ['Nei Begun Partners'],
  },
  admin: {
    id: 'admin-1',
    name: 'Rick Schlimback',
    firstName: 'Rick',
    email: 'rick@warmeleads.eu',
  },
  branchesSelected: [],
  optionValues: {},
  unsubscribeUrl: null,
  signatureHtml: '<p>Met vriendelijke groet,<br>Rick</p>',
  baseUrl: 'https://warmeleads.eu',
};

describe('neiBegunIntroTemplate', () => {
  it('is transactional en alleen voor prospects', () => {
    expect(neiBegunIntroTemplate.scope).toBe('transactional');
    expect(neiBegunIntroTemplate.applicableTo).toEqual(['prospect']);
  });

  it('rendert minimaal (geen aanvinkbare blokken aan)', () => {
    const out = neiBegunIntroTemplate.render({
      ...baseCtx,
      optionValues: {
        mention_program_intro: false,
        mention_four_themes: false,
        mention_measure_29: false,
        mention_snn_subsidy: false,
        mention_postcode_phasing: false,
        mention_wl_value: false,
        mention_official_link: false,
        cta_free_account: false,
      },
    });
    expect(out.html).toContain('Hallo Hendrik');
    expect(out.html).toContain('Mijn naam is Rick');
    expect(out.html).not.toContain('Wat is Nij Begun?');
    expect(out.html).not.toContain('Maatregel 29');
    expect(out.html).not.toContain('Maak gratis account aan');
    expect(out.warnings).toEqual([]);
  });

  it('rendert volledig met alle blokken aan', () => {
    const out = neiBegunIntroTemplate.render({
      ...baseCtx,
      optionValues: {
        opening_line: 'Mooi om je gisteren even te spreken.',
        mention_program_intro: true,
        mention_four_themes: true,
        mention_measure_29: true,
        mention_snn_subsidy: true,
        mention_postcode_phasing: true,
        mention_wl_value: true,
        mention_official_link: true,
        cta_free_account: true,
      },
    });
    expect(out.html).toContain('Mooi om je gisteren');
    expect(out.html).toContain('Wat is Nij Begun?');
    expect(out.html).toContain('De vier thema');
    expect(out.html).toContain('Maatregel 29');
    expect(out.html).toContain('€1,65 miljard');
    expect(out.html).toContain('SNN');
    expect(out.html).toContain('50% tot 100%');
    expect(out.html).toContain('€40.000');
    expect(out.html).toContain('Gefaseerde uitrol');
    expect(out.html).toContain('Wat WarmeLeads voor jou doet');
    expect(out.html).toContain('nijbegun.nl');
    expect(out.html).toContain('snn.nl');
    expect(out.html).toContain('Maak gratis account aan');
    expect(out.html).toContain('warmeleads.eu/gratis-account');
    expect(out.warnings).toEqual([]);
  });

  it('CTA-URL kan worden overruled', () => {
    const out = neiBegunIntroTemplate.render({
      ...baseCtx,
      optionValues: {
        cta_free_account: true,
        cta_url_override: 'https://warmeleads.eu/portal',
      },
    });
    expect(out.html).toContain('https://warmeleads.eu/portal');
    expect(out.html).not.toContain('warmeleads.eu/gratis-account');
  });

  it('waarschuwt bij onbekende merge-tags in openingszin', () => {
    const out = neiBegunIntroTemplate.render({
      ...baseCtx,
      optionValues: {
        opening_line: 'Hoi {{first_name}}, leuk je {{onbekende_tag}} te ontmoeten.',
      },
    });
    expect(out.warnings || []).toEqual(expect.arrayContaining([expect.stringContaining('onbekende_tag')]));
  });

  it('subject default verwijst naar Nij Begun + 50-100% subsidie', () => {
    const subject = neiBegunIntroTemplate.defaultSubject(baseCtx);
    expect(subject).toContain('Nij Begun');
    expect(subject).toContain('50-100%');
  });

  it('rendert geen unsubscribe-blok wanneer unsubscribeUrl null is (transactioneel)', () => {
    const out = neiBegunIntroTemplate.render({
      ...baseCtx,
      unsubscribeUrl: null,
    });
    expect(out.html).not.toContain('Schrijf je hier uit');
  });

  it('rendert wel een unsubscribe-blok als de URL toch wordt meegegeven', () => {
    const out = neiBegunIntroTemplate.render({
      ...baseCtx,
      unsubscribeUrl: 'https://warmeleads.eu/uitschrijven?t=abc',
    });
    expect(out.html).toContain('Schrijf je hier uit');
  });

  it('renderTemplate gebruikt template-default subject als override leeg is', () => {
    const out = renderTemplate(neiBegunIntroTemplate, baseCtx, '');
    expect(out.subject).toContain('Nij Begun');
  });

  it('renderTemplate respecteert subject-override', () => {
    const out = renderTemplate(neiBegunIntroTemplate, baseCtx, 'Aangepast onderwerp');
    expect(out.subject).toBe('Aangepast onderwerp');
  });
});

describe('listTemplates met branche-eis', () => {
  it('toont nei_begun_intro alleen wanneer recipientBranches nei_begun_partners bevat', () => {
    const withoutBranches = listTemplates('prospect').map(t => t.key);
    expect(withoutBranches).not.toContain('nei_begun_intro');

    const irrelevantBranches = listTemplates('prospect', ['thuisbatterij']).map(t => t.key);
    expect(irrelevantBranches).not.toContain('nei_begun_intro');

    const correctBranches = listTemplates('prospect', ['nei_begun_partners']).map(t => t.key);
    expect(correctBranches).toContain('nei_begun_intro');

    const mixedBranches = listTemplates('prospect', ['airco', 'nei_begun_partners']).map(t => t.key);
    expect(mixedBranches).toContain('nei_begun_intro');
  });

  it('filtert applicableTo en branche-eis tegelijk correct', () => {
    const forCustomer = listTemplates('customer', ['nei_begun_partners']).map(t => t.key);
    expect(forCustomer).not.toContain('nei_begun_intro');
  });

  it('reguliere templates blijven zichtbaar zonder branche-context', () => {
    const all = listTemplates('prospect').map(t => t.key);
    expect(all).toContain('intro_prospect');
    expect(all).toContain('custom');
  });
});

describe('templateBranchRequirement', () => {
  it('geeft de eis terug voor nei_begun_intro', () => {
    expect(templateBranchRequirement('nei_begun_intro')).toEqual(['nei_begun_partners']);
  });

  it('geeft undefined voor templates zonder eis', () => {
    expect(templateBranchRequirement('intro_prospect')).toBeUndefined();
    expect(templateBranchRequirement('custom')).toBeUndefined();
  });
});

describe('findRecipientsMissingBranchRequirement', () => {
  it('lege array voor templates zonder branche-eis', () => {
    expect(
      findRecipientsMissingBranchRequirement('intro_prospect', [
        { id: 'a', branchSlugs: [] },
        { id: 'b', branchSlugs: ['anything'] },
      ]),
    ).toEqual([]);
  });

  it('flagged recipients zonder vereiste branche', () => {
    const result = findRecipientsMissingBranchRequirement('nei_begun_intro', [
      { id: 'has-it', branchSlugs: ['nei_begun_partners'] },
      { id: 'mixed', branchSlugs: ['airco', 'nei_begun_partners'] },
      { id: 'wrong', branchSlugs: ['airco'] },
      { id: 'empty', branchSlugs: [] },
    ]);
    expect(result.sort()).toEqual(['empty', 'wrong']);
  });

  it('lege array wanneer alle recipients voldoen', () => {
    expect(
      findRecipientsMissingBranchRequirement('nei_begun_intro', [
        { id: 'a', branchSlugs: ['nei_begun_partners'] },
      ]),
    ).toEqual([]);
  });
});
