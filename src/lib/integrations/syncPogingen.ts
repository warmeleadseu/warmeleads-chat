/**
 * Hoe vaak de retry-cron een mislukte levering aan een koppeling opnieuw
 * probeert. Staat hier los, zodat een koppeling een levering ook zelf als
 * "niet meer proberen" kan markeren (teller op het maximum) zonder de cron
 * te importeren.
 */
export const MAX_SYNC_ATTEMPTS = 8;
