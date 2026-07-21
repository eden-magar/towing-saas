/**
 * Public share routes — outside dashboard/customer/driver layouts.
 * No auth gate; AuthProvider in root layout does not redirect.
 */
export default function ShareLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className="min-h-full bg-gray-50 text-gray-900">{children}</div>
}
