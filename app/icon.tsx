import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

// --primary: 240 5.9% 10% → #18181b
const PRIMARY = '#18181b';
const ON_PRIMARY = '#fafafa';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          background: PRIMARY,
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            color: ON_PRIMARY,
            fontSize: 20,
            fontWeight: 700,
            fontFamily: 'serif',
            lineHeight: 1,
          }}
        >
          L
        </span>
      </div>
    ),
    { ...size },
  );
}
