import { HttpParams } from '@angular/common/http';

export function toHttpParams(
  query: Record<string, string | number | boolean | undefined | null>,
): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    params = params.set(key, String(value));
  }
  return params;
}
