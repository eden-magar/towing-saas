'use client'

interface LicensePlateProps {
  plate: string
  size?: 'sm' | 'md' | 'lg'
}

const SIZE_CONFIG = {
  sm: { height: 34, fontSize: 18, stripWidth: 18, ilFontSize: 8, paddingX: 8 },
  md: { height: 48, fontSize: 26, stripWidth: 22, ilFontSize: 10, paddingX: 10 },
  lg: { height: 54, fontSize: 30, stripWidth: 26, ilFontSize: 11, paddingX: 12 },
} as const

export default function LicensePlate({ plate, size = 'md' }: LicensePlateProps) {
  const config = SIZE_CONFIG[size]

  return (
    <div
      dir="ltr"
      className="inline-flex items-stretch overflow-hidden shrink-0"
      style={{
        height: config.height,
        backgroundColor: '#f5d800',
        border: '2px solid #1a1a1a',
        borderRadius: 6,
      }}
    >
      <div
        className="flex items-center justify-center font-bold"
        style={{
          paddingLeft: config.paddingX,
          paddingRight: config.paddingX,
          fontSize: config.fontSize,
          color: '#1a1a1a',
          letterSpacing: '0.08em',
        }}
      >
        {plate}
      </div>
      <div
        className="flex items-center justify-center shrink-0 font-bold"
        style={{
          width: config.stripWidth,
          backgroundColor: '#0048a8',
          color: '#f5d800',
          fontSize: config.ilFontSize,
        }}
      >
        IL
      </div>
    </div>
  )
}
