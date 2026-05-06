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
  INFO_BLOCK_OPTIONS,
  paragraph,
  quoteBox,
  readInfoFlags,
  renderInfoBlocks,
} from './_helpers';

/**
 * Vast gehouden in 1 constante zodat we het bedrag op één plek kunnen
 * bijstellen als het tarief in de toekomst verandert.
 */
const RESEARCH_FEE_LABEL = '€1.000';

/**
 * Sjabloon: "Onderzoek nieuwe niche / maatwerk". Bedoeld voor prospects én
 * klanten die interesse hebben in een branche die (nog) buiten onze acht
 * standaardverticals valt. De toon is consultatief, geen sales-push: een
 * helder en eerlijk verhaal over wat we doen, wat het kost, hoe lang het
 * duurt en waarom het feitelijk geen verloren geld is. De cijfertegels en
 * het groene reassurance-blok pikken het visuele zwaartepunt op zonder dat
 * de mail commercieel agressief aanvoelt.
 */
export const nicheResearchTemplate: EmailTemplate = {
  key: 'niche_research',
  label: 'Onderzoek nieuwe niche',
  description:
    'Leg helder uit hoe ons nicheonderzoek werkt voor branches buiten ons standaardaanbod: €1.000 investering die 100% terugkomt in leads, doorlooptijd 2-4 weken.',
  applicableTo: ['prospect', 'customer'],
  scope: 'pricing',
  options: [
    {
      key: 'niche_name',
      label: 'Naam van de niche / branche',
      type: 'text',
      placeholder: 'bv. zwembadbouw, kelderafdichting, koeltechniek',
      description: 'Wordt in het onderwerp en de body gebruikt.',
    },
    {
      key: 'context_recap',
      label: 'Persoonlijke opening (waar haakte het op aan)',
      type: 'textarea',
      placeholder:
        'Naar aanleiding van ons gesprek vorige week over leads voor jouw branche.',
      description: 'Optioneel. Wordt direct na de aanhef geplaatst.',
    },
    {
      key: 'show_value_breakdown',
      label: 'Cijfertegels (€1.000 / 100% terug / 2-4 wk) tonen',
      type: 'boolean',
      default: true,
    },
    {
      key: 'show_what_we_do',
      label: 'Uitleg wat het onderzoek omvat',
      type: 'boolean',
      default: true,
    },
    {
      key: 'show_timeline',
      label: 'Doorlooptijd & wekelijkse check-ins toelichten',
      type: 'boolean',
      default: true,
    },
    {
      key: 'show_no_risk',
      label: '"Geen verloren geld"-reassurance tonen',
      type: 'boolean',
      default: true,
    },
    {
      key: 'plan_gesprek_cta',
      label: '"Plan een gesprek"-knop tonen',
      type: 'boolean',
      default: true,
    },
    ...INFO_BLOCK_OPTIONS,
  ],
  defaultSubject: ctx => {
    const niche = asString(ctx.optionValues.niche_name).trim();
    if (niche) {
      return `Marktonderzoek ${niche}: investering komt 100% terug in leads`;
    }
    return 'Nieuwe niche aanboren? Investering komt 100% terug in leads';
  },
  render: ctx => {
    const niche = asString(ctx.optionValues.niche_name).trim();
    const intro = asString(ctx.optionValues.context_recap).trim();
    // Ontbrekende keys (oud opgeslagen drafts) tellen als default-true.
    const truthyDefault = (v: unknown) =>
      v === undefined || v === null ? true : asBoolean(v);
    const showValue = truthyDefault(ctx.optionValues.show_value_breakdown);
    const showWhatWeDo = truthyDefault(ctx.optionValues.show_what_we_do);
    const showTimeline = truthyDefault(ctx.optionValues.show_timeline);
    const showNoRisk = truthyDefault(ctx.optionValues.show_no_risk);
    const planGesprek = truthyDefault(ctx.optionValues.plan_gesprek_cta);

    const warnings: string[] = [];
    const parts: string[] = [];
    const branchPhrase = niche
      ? `<strong>${escape(niche)}</strong>`
      : 'jouw branche';

    parts.push(
      `<p style="margin:0 0 18px;font-size:16px;font-weight:600">${greetingLine(
        ctx,
      )}</p>`,
    );

    if (intro) {
      const m = applyMergeTags(intro, ctx);
      if (m.missing.length > 0) {
        warnings.push(
          `Onbekende merge-tags in openingszin: ${m.missing.join(', ')}`,
        );
      }
      parts.push(paragraph(escape(m.text)));
    }

    parts.push(
      paragraph(
        `Je gaf aan dat je geïnteresseerd bent in leads voor ${branchPhrase}. Omdat dit (nog) buiten onze acht standaardverticals valt, doen we eerst een gericht <strong>marktonderzoek</strong> voordat we een campagne live zetten. Op die manier zorgen we ervoor dat de leads die je krijgt vanaf dag één rendabel zijn, in plaats van dat we wat experimenten op jouw rekening uittesten.`,
      ),
    );

    if (showValue) {
      parts.push(
        `<table cellpadding="0" cellspacing="6" role="presentation" style="margin:18px 0;border-collapse:separate;width:100%">
          <tr>
            <td valign="top" align="center" style="padding:14px 6px;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;width:33%">
              <div style="font-size:22px;font-weight:800;color:#3B2F75;line-height:1.1">${RESEARCH_FEE_LABEL}</div>
              <div style="margin-top:4px;font-size:11px;color:#64748b;line-height:1.3">Eenmalig onderzoek</div>
            </td>
            <td valign="top" align="center" style="padding:14px 6px;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;width:33%">
              <div style="font-size:22px;font-weight:800;color:#3B2F75;line-height:1.1">100%</div>
              <div style="margin-top:4px;font-size:11px;color:#64748b;line-height:1.3">Terug in leads</div>
            </td>
            <td valign="top" align="center" style="padding:14px 6px;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;width:33%">
              <div style="font-size:22px;font-weight:800;color:#3B2F75;line-height:1.1">2-4 wk</div>
              <div style="margin-top:4px;font-size:11px;color:#64748b;line-height:1.3">Doorlooptijd</div>
            </td>
          </tr>
        </table>`,
      );

      parts.push(
        `<div style="margin:0 0 18px;padding:16px 18px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;font-size:14px;line-height:1.6;color:#065f46">
          <strong>${RESEARCH_FEE_LABEL} is geen kostenpost. Het is een voorschot op je eerste leads.</strong> Zodra de campagne live gaat crediteren we het volledige bedrag terug in jouw eerste leadlevering. Netto kost het onderzoek je dus niets extra; het is een commitment-signaal dat we het allebei serieus aanpakken.
        </div>`,
      );
    }

    if (showWhatWeDo) {
      parts.push(
        `<p style="margin:24px 0 10px;font-size:13px;font-weight:700;color:#3B2F75;text-transform:uppercase;letter-spacing:0.6px">Wat we concreet voor je uitzoeken</p>`,
      );
      parts.push(
        `<ul style="margin:8px 0 14px;padding:0 0 0 22px;color:#0f172a;font-size:14px">
          <li style="margin:0 0 6px;padding:0 0 0 4px;line-height:1.55"><strong>Doelgroep- en intentieonderzoek</strong>: hoe ziet de typische koper eruit en welke triggers zetten ze in beweging?</li>
          <li style="margin:0 0 6px;padding:0 0 0 4px;line-height:1.55"><strong>Live test-campagnes op Meta en Google</strong>: we draaien gerichte advertenties om realistische conversies en kostprijs per lead te meten.</li>
          <li style="margin:0 0 6px;padding:0 0 0 4px;line-height:1.55"><strong>Eerste validatie-leads</strong>: een kleine batch om het kwaliteitsniveau en de aansluiting met jouw business te toetsen.</li>
          <li style="margin:0 0 6px;padding:0 0 0 4px;line-height:1.55"><strong>Tariefadvies en volumeschatting</strong>: concreet inzicht in wat een lead in deze branche kost en hoeveel we per maand kunnen leveren.</li>
        </ul>`,
      );
    }

    if (showTimeline) {
      parts.push(
        `<p style="margin:24px 0 10px;font-size:13px;font-weight:700;color:#3B2F75;text-transform:uppercase;letter-spacing:0.6px">Wat je van ons mag verwachten</p>`,
      );
      parts.push(
        `<ul style="margin:8px 0 14px;padding:0 0 0 22px;color:#0f172a;font-size:14px">
          <li style="margin:0 0 6px;padding:0 0 0 4px;line-height:1.55">Doorlooptijd <strong>2 tot 4 weken</strong>, afhankelijk van de complexiteit van de niche.</li>
          <li style="margin:0 0 6px;padding:0 0 0 4px;line-height:1.55">Wekelijkse check-ins met je accountmanager (${escape(
            ctx.admin.firstName,
          )}) zodat je live meekijkt met de uitkomsten.</li>
          <li style="margin:0 0 6px;padding:0 0 0 4px;line-height:1.55">Aan het einde een helder <strong>go / no-go advies</strong>: gaan we live, of zien we onvoldoende potentie? In beide gevallen ben je transparant geadviseerd zonder vervolgverplichting.</li>
        </ul>`,
      );
    }

    if (showNoRisk) {
      parts.push(
        quoteBox(
          `Van de niches die we onderzoeken zetten we het overgrote deel daarna ook live. Loopt het onderzoek toch op niets uit, dan heb je voor ${RESEARCH_FEE_LABEL} alsnog concrete test-data, doelgroepinzicht en een onderbouwd tariefadvies in handen. Geen leadleveringen op je nek waar je niets mee kunt, en je weet meteen waar je qua marketing wel of niet op moet inzetten.`,
        ),
      );
    }

    const infoFlags = readInfoFlags(ctx.optionValues);
    parts.push(renderInfoBlocks(ctx, infoFlags));

    parts.push(
      paragraph(
        `Zullen we het in gang zetten? Reageer kort op deze mail of plan een gesprek in, dan stem ik de scope precies af op ${branchPhrase} en jullie regio.`,
      ),
    );

    if (planGesprek) {
      parts.push(ctaButton('Plan een gesprek', `${ctx.baseUrl}/plan-gesprek`));
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
