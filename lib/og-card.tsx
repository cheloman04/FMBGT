import { ImageResponse } from 'next/og';

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = 'image/png';
export const OG_ALT =
  'Florida Mountain Bike Guides — guided mountain bike and paved trail tours across Central Florida';

/**
 * Shared social share card, rendered at request time by next/og.
 *
 * Satori (the renderer behind ImageResponse) only supports a subset of CSS:
 * every element with more than one child needs an explicit `display: flex`.
 */
export function renderOgCard() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: 'linear-gradient(135deg, #052e16 0%, #14532d 55%, #166534 100%)',
          color: '#ffffff',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: 26,
            letterSpacing: 4,
            textTransform: 'uppercase',
            color: '#86efac',
          }}
        >
          Florida Mountain Bike Guides
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 28,
            fontSize: 74,
            fontWeight: 700,
            lineHeight: 1.1,
            maxWidth: 940,
          }}
        >
          Guided Mountain Bike Tours in Central Florida
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 32,
            fontSize: 32,
            color: '#d1fae5',
            maxWidth: 880,
          }}
        >
          Bikes included. All skill levels. Sanford, Mount Dora, DeLand, Ocala & beyond.
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 48,
            fontSize: 26,
            color: '#4ade80',
          }}
        >
          floridamountainbikeguides.com
        </div>
      </div>
    ),
    { ...OG_SIZE }
  );
}
