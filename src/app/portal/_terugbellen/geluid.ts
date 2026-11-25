/**
 * Twee korte tonen. De browser staat geluid pas toe nadat iemand op de pagina
 * heeft geklikt; lukt het niet, dan blijft het stil en is er alleen de pop-up.
 */
export function speelSeintje(): void {
  try {
    const ctx = new AudioContext();
    const toon = (hz: number, start: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = hz;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
      g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + 0.25);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + start);
      o.stop(ctx.currentTime + start + 0.3);
    };
    toon(880, 0);
    toon(1175, 0.2);
    setTimeout(() => void ctx.close().catch(() => {}), 1000);
  } catch {
    /* geen geluid beschikbaar */
  }
}
