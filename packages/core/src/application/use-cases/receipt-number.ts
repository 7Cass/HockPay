export function buildReceiptNumber(
  storeId: string,
  dateStr: string,
  sequence: number,
): string {
  const storeSegment = storeId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

  return `RCP-${dateStr}-${storeSegment}-${String(sequence).padStart(5, "0")}`;
}
