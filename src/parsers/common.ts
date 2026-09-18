/** Shared parsing helpers. */

const CURRENCY_MAP: Record<string, string> = {
  'Kč': 'CZK',
  '€': 'EUR',
};

/** Collapse whitespace (incl. non-breaking spaces) and strip word joiners common in Vilgain markup. */
export function cleanText(text: string): string {
  return text
    .replace(/\u2060/g, '')
    .replace(/[\s\u00a0]+/g, ' ')
    .trim();
}

/** Parse a price text like "999 Kč" or "1 234,50 Kč" into a number and ISO currency. */
export function parsePriceText(text: string): { price: number; currency: string } | undefined {
  const cleaned = cleanText(text);
  const match = cleaned.match(/([\d ]+(?:[.,]\d+)?)\s*(Kč|€|[A-Z]{3})/);
  if (!match) return undefined;
  const price = parseFloat(match[1].replace(/ /g, '').replace(',', '.'));
  if (Number.isNaN(price)) return undefined;
  return { price, currency: CURRENCY_MAP[match[2]] ?? match[2] };
}

/** Parse rating from a screen-reader text like "Hodnocení 4.6/5, 425 recenzí". */
export function parseRatingText(text: string): { rating: string; reviewCount: number } | undefined {
  const match = cleanText(text).match(/(\d+(?:[.,]\d+)?\/5)\D*(\d+)/);
  if (!match) return undefined;
  return { rating: match[1].replace(',', '.'), reviewCount: parseInt(match[2], 10) };
}

/**
 * Extract JSON arrays pushed to `dataLayer` / `dataLayerV2` in inline scripts.
 * Vilgain pages embed analytics data as
 * `([{...}]).forEach(function (data) { dataLayer.push(data); })`,
 * which is the easiest machine-readable source of cart and product data.
 */
export function extractDataLayerArrays(html: string): unknown[][] {
  const arrays: unknown[][] = [];
  let from = 0;
  while (true) {
    const start = html.indexOf('([', from);
    if (start === -1) break;
    from = start + 2;

    const end = findArrayEnd(html, start + 1);
    if (end === -1) continue;
    if (!/^\)\.forEach\(function \(data\) \{ dataLayer(V2)?\.push/.test(html.slice(end + 1, end + 60))) continue;

    try {
      const parsed = JSON.parse(html.slice(start + 1, end + 1));
      if (Array.isArray(parsed)) arrays.push(parsed);
    } catch {
      // Not valid JSON (e.g. contains JS expressions) - skip.
    }
  }
  return arrays;
}

/** Given the index of a "[", return the index of its matching "]" (JSON-aware), or -1. */
function findArrayEnd(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (char === '\\') i++;
      else if (char === '"') inString = false;
    } else if (char === '"') {
      inString = true;
    } else if (char === '[' || char === '{') {
      depth++;
    } else if (char === ']' || char === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Find the first object in dataLayer arrays that satisfies the predicate. */
export function findDataLayerObject<T = Record<string, unknown>>(
  html: string,
  predicate: (obj: Record<string, unknown>) => boolean
): T | undefined {
  for (const array of extractDataLayerArrays(html)) {
    for (const item of array) {
      if (item && typeof item === 'object' && predicate(item as Record<string, unknown>)) {
        return item as T;
      }
    }
  }
  return undefined;
}
