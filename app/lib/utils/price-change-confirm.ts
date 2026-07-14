/** Money compare / confirm-copy helpers for edit-path price rewrite gates. */

export function roundMoney2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100
}

export function pricesMateriallyDiffer(
  a: number | null | undefined,
  b: number | null | undefined,
): boolean {
  return roundMoney2(a ?? 0) !== roundMoney2(b ?? 0)
}

export function formatPriceRecalcConfirmMessage(oldPrice: number, newPrice: number): string {
  return `המחיר חושב מחדש: ₪${roundMoney2(oldPrice).toFixed(2)} → ₪${roundMoney2(newPrice).toFixed(2)}`
}
