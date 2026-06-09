import type { EmailTemplate } from './types';
import {
  applyMergeTags,
  asBoolean,
  asString,
  composeShell,
  ctaButton,
  escape,
  greetingLine,
  htmlToText,
  paragraph,
} from './_helpers';

const NIJ_BEGUN_OFFICIAL_URL = 'https://www.nijbegun.nl';
const SNN_OFFICIAL_URL = 'https://www.snn.nl';

const sectionTitle = (label: string): string =>
  `<p style="margin:24px 0 10px;font-size:13px;font-weight:700;color:#3B2F75;text-transform:uppercase;letter-spacing:0.6px">${escape(label)}</p>`;

const infoCard = (html: string): string =>
  `<div style="margin:0 0 14px;padding:16px 18px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;line-height:1.6;color:#0f172a">${html}</div>`;

const bulletList = (items: string[]): string => {
  const lis = items
    .map(
      i =>
        `<li style="margin:0 0 6px;padding:0 0 0 4px;line-height:1.55">${i}</li>`,
    )
    .join('');
  return `<ul style="margin:8px 0 14px;padding:0 0 0 22px;color:#0f172a;font-size:14px">${lis}</ul>`;
};

export const neiBegunIntroTemplate: EmailTemplate = {
  key: 'nei_begun_intro',
  label: 'Nij Begun — kennismaking',
  description:
    'Persoonlijke introductie naar een Nij Begun-prospect (installateur Groningen/N-Drenthe) met aanvinkbare programma-blokken (4 thema\'s, Maatregel 29, SNN-subsidies). Conversie-CTA: gratis account aanmaken op het leadportaal.',
  applicableTo: ['prospect'],
  scope: 'transactional',
  options: [
    {
      key: 'opening_line',
      label: 'Persoonlijke openingszin',
      type: 'textarea',
      placeholder: 'Mooi om je laatst op de installatiebeurs te spreken.',
      description:
        'Optioneel. Wordt direct na de aanhef getoond. Merge-tags zoals {{first_name}} of {{company_name}} mogen.',
    },
    {
      key: 'mention_program_intro',
      label: 'Korte intro "Wat is Nij Begun?"',
      type: 'boolean',
      default: true,
      description:
        'Eén alinea: nieuw begin voor Groningen en Noord-Drenthe, kabinetsreactie op het rapport van de Parlementaire Enquêtecommissie Aardgaswinning, 30 jaar investeringsprogramma met 50 maatregelen.',
    },
    {
      key: 'mention_four_themes',
      label: 'De vier thema\'s van Nij Begun benoemen',
      type: 'boolean',
      default: false,
      description: 'Herstel · Isolatieaanpak · Sociaal · Economie.',
    },
    {
      key: 'mention_measure_29',
      label: 'Maatregel 29: Isolatieaanpak (€1,65 mrd)',
      type: 'boolean',
      default: true,
      description:
        'Doel: Groningen en Noord-Drenthe als eerste regio aardgasvrij maken via dak-, muur- en glasisolatie.',
    },
    {
      key: 'mention_snn_subsidy',
      label: 'SNN-subsidie tot 50-100% (max €40.000) noemen',
      type: 'boolean',
      default: true,
      description:
        'Het meest aansprekende blok voor installateurs: hun klanten krijgen via SNN een groot deel van de isolatiekosten vergoed.',
    },
    {
      key: 'mention_postcode_phasing',
      label: 'Gefaseerde uitrol per postcodegebied vermelden',
      type: 'boolean',
      default: false,
      description:
        'Subsidies worden gefaseerd opengesteld per postcode; wij houden de status actueel zodat campagnes meebewegen.',
    },
    {
      key: 'mention_wl_value',
      label: 'Wat WarmeLeads concreet biedt voor deze prospect',
      type: 'boolean',
      default: true,
      description:
        'Warme, exclusieve isolatie-leads uit Groningen/Noord-Drenthe, realtime in het portaal, gekoppeld aan de actuele Nij Begun-/SNN-uitrol.',
    },
    {
      key: 'mention_official_link',
      label: 'Link naar nijbegun.nl en snn.nl meenemen',
      type: 'boolean',
      default: false,
      description: 'Voor prospects die zelf eerst willen lezen op de officiële sites.',
    },
    {
      key: 'cta_free_account',
      label: '"Maak gratis account aan"-knop tonen',
      type: 'boolean',
      default: true,
      description:
        'Primaire CTA naar /gratis-account: in een paar minuten een gratis WarmeLeads-account aanmaken en direct meekijken in het leadportaal.',
    },
    {
      key: 'cta_url_override',
      label: 'CTA-URL overrulen (optioneel)',
      type: 'text',
      placeholder: 'https://warmeleads.eu/gratis-account',
      description: 'Laat leeg voor de standaard /gratis-account-pagina.',
    },
  ],
  defaultSubject: () => 'Nij Begun: zo halen jouw klanten 50-100% subsidie binnen',
  render: ctx => {
    const opening = asString(ctx.optionValues.opening_line).trim();
    const showProgramIntro = asBoolean(ctx.optionValues.mention_program_intro);
    const showFourThemes = asBoolean(ctx.optionValues.mention_four_themes);
    const showMeasure29 = asBoolean(ctx.optionValues.mention_measure_29);
    const showSnnSubsidy = asBoolean(ctx.optionValues.mention_snn_subsidy);
    const showPhasing = asBoolean(ctx.optionValues.mention_postcode_phasing);
    const showWlValue = asBoolean(ctx.optionValues.mention_wl_value);
    const showOfficialLink = asBoolean(ctx.optionValues.mention_official_link);
    const showCta = asBoolean(ctx.optionValues.cta_free_account);
    const ctaOverride = asString(ctx.optionValues.cta_url_override).trim();

    const warnings: string[] = [];
    const parts: string[] = [];

    parts.push(
      `<p style="margin:0 0 18px;font-size:16px;font-weight:600">${greetingLine(ctx)}</p>`,
    );

    if (opening) {
      const m = applyMergeTags(opening, ctx);
      if (m.missing.length > 0) {
        warnings.push(`Onbekende merge-tags in openingszin: ${m.missing.join(', ')}`);
      }
      parts.push(paragraph(escape(m.text)));
    }

    parts.push(
      paragraph(
        `Mijn naam is ${escape(ctx.admin.firstName)} en ik ben accountmanager bij <strong>WarmeLeads</strong>. Wij genereren warme, exclusieve isolatie-leads in Groningen en Noord-Drenthe, afgestemd op de uitrol van het <strong>Nij Begun</strong>-programma. Hieronder kort waarom dat voor jouw bedrijf relevant is.`,
      ),
    );

    if (showProgramIntro) {
      parts.push(sectionTitle('Wat is Nij Begun?'));
      parts.push(
        paragraph(
          'Nij Begun (Gronings voor "nieuw begin") is het grootschalige herstel- en toekomstprogramma van de Nederlandse overheid voor de inwoners van Groningen en Noord-Drenthe. Het is de officiële kabinetsreactie op het rapport van de Parlementaire Enquêtecommissie Aardgaswinning Groningen, waarin werd vastgesteld dat de belangen van de inwoners jarenlang structureel zijn genegeerd. Het programma loopt 30 jaar en bestaat uit een pakket van 50 specifieke maatregelen.',
        ),
      );
    }

    if (showFourThemes) {
      parts.push(sectionTitle('De vier thema\'s'));
      parts.push(
        bulletList([
          '<strong>Herstel</strong>: milder en menselijker afhandelen van fysieke aardbevingsschade en versneld versterken van onveilige woningen.',
          '<strong>Isolatieaanpak</strong>: woningen isoleren en ventileren om Groningen en Noord-Drenthe als eerste regio aardgasvrij te maken.',
          '<strong>Sociaal</strong>: investeringen in gezondheid, welzijn en leefbaarheid; verkleinen van achterstanden bij onder andere de jeugd.',
          '<strong>Economie</strong>: financiële impulsen, subsidies en fondsen voor het mkb, innovatie en regionale verduurzaming.',
        ]),
      );
    }

    if (showMeasure29) {
      parts.push(sectionTitle('Maatregel 29 — Isolatieaanpak'));
      parts.push(
        paragraph(
          'Onder Maatregel 29 reserveert het kabinet <strong>€1,65 miljard</strong> om woningen in Groningen en Noord-Drenthe te isoleren en te ventileren. Doel: de regio als <strong>eerste van Nederland aardgasvrij</strong> maken. Voor isolatiebedrijven betekent dit een meerjarige, gegarandeerde stroom aan opdrachten voor dak-, muur- en glasisolatie.',
        ),
      );
    }

    if (showSnnSubsidy) {
      parts.push(sectionTitle('Wat krijgt de eindklant via SNN?'));
      parts.push(
        infoCard(
          'Via regelingen van het <strong>Samenwerkingsverband Noord-Nederland (SNN)</strong> kunnen woningeigenaren <strong>50% tot 100% van de isolatiekosten</strong> vergoed krijgen tot <strong>maximaal €40.000</strong> per woning, voor zaken als dak-, muur- en glasisolatie.',
        ),
      );
      parts.push(
        paragraph(
          'Voor jouw klanten betekent dit dat de drempel om te kiezen voor isoleren <strong>aanzienlijk lager ligt</strong> dan in de rest van Nederland — wat zich direct vertaalt in hogere conversie en grotere ordergroottes.',
        ),
      );
    }

    if (showPhasing) {
      parts.push(sectionTitle('Gefaseerde uitrol per postcodegebied'));
      parts.push(
        paragraph(
          'De SNN-regelingen worden <strong>gefaseerd per postcodegebied</strong> opengesteld. Wij houden actief bij welke postcodes op dit moment subsidiabel zijn, zodat onze campagnes precies daar lopen waar jij vandaag rendement kunt halen — en niet in gebieden die nog op opening wachten.',
        ),
      );
    }

    if (showWlValue) {
      parts.push(sectionTitle('Wat WarmeLeads voor jou doet'));
      parts.push(
        bulletList([
          '<strong>Exclusieve, verse isolatie-leads</strong> uit Groningen en Noord-Drenthe — niet doorverkocht of gedeeld.',
          'Realtime in jouw <strong>online portaal</strong>: direct bellen, WhatsAppen of mailen vanuit het portaal.',
          'Campagnes <strong>afgestemd op de actuele SNN-postcodefasering</strong>, dus alleen leads waar jouw klant ook echt subsidie kan aanvragen.',
          'Telefoon- en e-mailverificatie + adresverrijking, zodat je geen tijd kwijt bent aan onjuiste contactgegevens.',
          'Persoonlijke accountmanager (geen callcenter, geen abonnement, geen lock-in) — je betaalt per lead.',
        ]),
      );
    }

    if (showOfficialLink) {
      parts.push(sectionTitle('Meer lezen op de officiële sites'));
      parts.push(
        paragraph(
          `Programma-overzicht en actuele updates: <a href="${NIJ_BEGUN_OFFICIAL_URL}" style="color:#3B2F75;font-weight:600;text-decoration:underline">nijbegun.nl</a>. Subsidieregelingen voor inwoners en ondernemers: <a href="${SNN_OFFICIAL_URL}" style="color:#3B2F75;font-weight:600;text-decoration:underline">snn.nl</a>.`,
        ),
      );
    }

    parts.push(
      paragraph(
        'De snelste manier om te zien wat dit concreet voor jouw bedrijf betekent: maak <strong>gratis</strong> een account aan op ons leadportaal. Je ziet dan direct welk volume we op dit moment in jouw regio leveren, welke postcodegebieden actief subsidiabel zijn en wat een eerste batch zou kosten. Geen abonnement, geen vaste kosten, geen verplichtingen — pas wanneer je een batch bestelt, betaal je per lead.',
      ),
    );

    if (showCta) {
      const ctaUrl = ctaOverride || `${ctx.baseUrl}/gratis-account`;
      parts.push(ctaButton('Maak gratis account aan', ctaUrl));
    }

    parts.push(paragraph('Met vriendelijke groet,'));

    const html = composeShell({
      bodyHtml: parts.join(''),
      signatureHtml: ctx.signatureHtml,
      unsubscribeUrl: ctx.unsubscribeUrl,
    });

    return {
      subject: '',
      html,
      text: htmlToText(html),
      warnings,
    };
  },
};
