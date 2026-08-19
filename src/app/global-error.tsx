'use client';

/**
 * Vangt fouten op die in de root layout zelf optreden. Deze component vervangt
 * de volledige layout, dus globals.css is hier niet gegarandeerd geladen —
 * daarom inline styles in plaats van Tailwind-klassen.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="nl">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '2rem',
          textAlign: 'center',
          background: '#1A1A2E',
          color: '#ffffff',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        }}
      >
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
          WarmeLeads is even niet bereikbaar
        </h1>
        <p style={{ maxWidth: '28rem', margin: 0, color: 'rgba(255,255,255,.7)', lineHeight: 1.6 }}>
          Er ging iets mis bij het laden van de site. Probeer het opnieuw; blijft het misgaan, kijk
          dan over een paar minuten nog eens.
        </p>
        {error.digest && (
          <p style={{ fontFamily: 'monospace', fontSize: '.75rem', color: 'rgba(255,255,255,.4)' }}>
            Foutcode: {error.digest}
          </p>
        )}
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: '.5rem',
            border: 'none',
            borderRadius: '.5rem',
            background: '#FF6B35',
            color: '#0b0b12',
            padding: '.7rem 1.25rem',
            fontSize: '.875rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Opnieuw proberen
        </button>
      </body>
    </html>
  );
}
