/**
 * Miniature Israeli-style license plate for portal list rows.
 * LTR digits inside RTL layouts; height aligned with status chips (~22px).
 */
export function PortalPlateBadge({ plate }: { plate: string }) {
  return (
    <span
      dir="ltr"
      className="inline-flex shrink-0 items-stretch max-w-[8.5rem] h-[22px] rounded-[3px] overflow-hidden border-2 border-blue-700 bg-yellow-300"
      title={plate}
    >
      <span
        aria-hidden
        className="flex w-3 shrink-0 items-center justify-center bg-blue-700 text-[6px] font-bold leading-none text-white tracking-tight"
      >
        IL
      </span>
      <span className="flex min-w-0 flex-1 items-center justify-center px-1.5 text-[12px] font-extrabold tabular-nums tracking-wide text-black truncate">
        {plate}
      </span>
    </span>
  )
}
