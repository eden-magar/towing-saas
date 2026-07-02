import { ChevronUp, ChevronDown } from 'lucide-react'

interface TowBlockClipIndicatorsProps {
  isTopClipped: boolean
  isBottomClipped: boolean
  size?: 'sm' | 'md'
}

/**
 * Small chevron indicators shown on a calendar tow block when its rendered
 * segment is clipped to a calendar day boundary — i.e. the tow continues from
 * the previous day (top) and/or into the next day (bottom). Shared between the
 * main calendar (day + week views) and the dashboard mini-calendar so both use
 * the identical visual.
 */
export function TowBlockClipIndicators({
  isTopClipped,
  isBottomClipped,
  size = 'sm',
}: TowBlockClipIndicatorsProps) {
  if (!isTopClipped && !isBottomClipped) return null

  const iconSize = size === 'sm' ? 10 : 12

  return (
    <>
      {isTopClipped && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none z-10">
          <ChevronUp size={iconSize} className="text-white/85" strokeWidth={3} />
        </div>
      )}
      {isBottomClipped && (
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 pointer-events-none z-10">
          <ChevronDown size={iconSize} className="text-white/85" strokeWidth={3} />
        </div>
      )}
    </>
  )
}
