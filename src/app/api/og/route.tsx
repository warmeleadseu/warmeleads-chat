import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

const CATEGORY_COLORS: Record<string, { bg: string; accent: string }> = {
  'markttrends': { bg: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)', accent: '#60a5fa' },
  'subsidies': { bg: 'linear-gradient(135deg, #065f46 0%, #059669 100%)', accent: '#6ee7b7' },
  'tips & strategie': { bg: 'linear-gradient(135deg, #6B21A8 0%, #a855f7 100%)', accent: '#c4b5fd' },
  'cases & inspiratie': { bg: 'linear-gradient(135deg, #92400e 0%, #d97706 100%)', accent: '#fcd34d' },
  'technologie': { bg: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)', accent: '#94a3b8' },
  'duurzaamheid': { bg: 'linear-gradient(135deg, #14532d 0%, #16a34a 100%)', accent: '#86efac' },
};

const DEFAULT_COLORS = { bg: 'linear-gradient(135deg, #6B21A8 0%, #DB2777 50%, #F97316 100%)', accent: '#fbbf24' };

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get('title') || 'WarmeLeads';
    const category = searchParams.get('category') || '';
    const description = searchParams.get('description') || '';
    const colors = CATEGORY_COLORS[category.toLowerCase()] || DEFAULT_COLORS;

    const titleSize = title.length > 60 ? 44 : title.length > 40 ? 52 : 60;

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background: colors.bg,
            padding: '60px 80px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 36, fontWeight: 900, color: 'white', letterSpacing: '-0.03em' }}>
              WarmeLeads
            </div>
            {category && (
              <div
                style={{
                  fontSize: 20,
                  color: colors.accent,
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  padding: '8px 24px',
                  borderRadius: 30,
                  fontWeight: 600,
                }}
              >
                {category}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 1, justifyContent: 'center' }}>
            <div
              style={{
                fontSize: titleSize,
                fontWeight: 800,
                color: 'white',
                lineHeight: 1.15,
                maxWidth: 1000,
                letterSpacing: '-0.03em',
              }}
            >
              {title}
            </div>
            {description && (
              <div style={{ fontSize: 26, color: 'rgba(255,255,255,0.75)', maxWidth: 900, lineHeight: 1.4 }}>
                {description}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <div style={{ fontSize: 18, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
              warmeleads.eu/blog
            </div>
            <div style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)' }} />
            <div style={{ fontSize: 18, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
              Leadgeneratie voor installateurs
            </div>
          </div>
        </div>
      ),
      { width: 1200, height: 630 },
    );
  } catch (e: any) {
    console.log(e.message);
    return new Response('Failed to generate the image', { status: 500 });
  }
}
