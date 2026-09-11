import { describe, it, expect } from 'vitest';
import {
  RECLAMATION_REASONS,
  RECLAMATION_STATUS_MAP,
  reclamationReasonLabel,
  isAfgehandeld,
} from '../reclamaties';

/**
 * De labels stonden eerder alleen in portal/page.tsx. Nu het overzicht een
 * eigen pagina heeft, lezen twee schermen uit dezelfde bron. Deze tests leggen
 * vast dat die bron compleet blijft: verdwijnt er een reden of status, dan
 * krijgt de klant ergens rauwe database-tekst als 'foutief_telefoonnummer' te
 * zien in plaats van een nette omschrijving.
 */

describe('reclamationReasonLabel', () => {
  it('vertaalt elke reden die de klant kan indienen', () => {
    expect(reclamationReasonLabel('foutief_telefoonnummer')).toBe('Foutief telefoonnummer');
    expect(reclamationReasonLabel('dubbele_lead')).toBe('Dubbele lead binnen 30 dagen');
    expect(reclamationReasonLabel('buiten_doelgebied')).toBe('Buiten mijn afgesproken gebied');
  });

  it('valt terug op de ruwe waarde bij een onbekende reden', () => {
    expect(reclamationReasonLabel('iets_nieuws')).toBe('iets_nieuws');
  });

  it('geeft niets terug bij een lege reden', () => {
    expect(reclamationReasonLabel(null)).toBe('');
    expect(reclamationReasonLabel(undefined)).toBe('');
    expect(reclamationReasonLabel('')).toBe('');
  });

  it('heeft voor elke reden een label zonder underscore', () => {
    for (const r of RECLAMATION_REASONS) {
      expect(r.label).not.toContain('_');
    }
  });
});

describe('RECLAMATION_STATUS_MAP', () => {
  it('dekt alle drie de statussen die de database kent', () => {
    expect(Object.keys(RECLAMATION_STATUS_MAP).sort()).toEqual(['approved', 'pending', 'rejected']);
  });

  it('geeft elke status een eigen label', () => {
    const labels = Object.values(RECLAMATION_STATUS_MAP).map(s => s.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('isAfgehandeld', () => {
  it('ziet goedgekeurd en afgewezen als afgehandeld', () => {
    expect(isAfgehandeld('approved')).toBe(true);
    expect(isAfgehandeld('rejected')).toBe(true);
  });

  it('ziet een openstaande reclamatie niet als afgehandeld', () => {
    /* Hierop hangt of de klant de toelichting te zien krijgt. Zou 'pending'
       hier true opleveren, dan leest de klant een beoordeling die er nog niet
       is. */
    expect(isAfgehandeld('pending')).toBe(false);
  });

  it('behandelt een onbekende status als nog niet afgehandeld', () => {
    expect(isAfgehandeld('onzin')).toBe(false);
    expect(isAfgehandeld('')).toBe(false);
  });
});
