export const PIX_MERCHANT_CITY_FALLBACK = "SAO PAULO";

export function resolvePixMerchantCity(city?: string | null): string {
  const normalized = city?.trim();
  if (!normalized) {
    return PIX_MERCHANT_CITY_FALLBACK;
  }

  return normalized.slice(0, 15).toUpperCase();
}
