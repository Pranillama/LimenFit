import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

// --primary: 240 5.9% 10% → #18181b
const PRIMARY = '#18181b';
const ON_PRIMARY = '#fafafa';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: PRIMARY,
          borderRadius: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            color: ON_PRIMARY,
            fontSize: 110,
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
