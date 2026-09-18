import * as cheerio from 'cheerio';
import { OrderSummary } from '../types.js';
import { cleanText } from './common.js';

/**
 * Parse the order history page (/muj-ucet/objednavky).
 *
 * Note: this parser is best-effort. It was developed against an account
 * without orders (the empty state) plus the generic page structure; the
 * row parsing may need adjustments once tested against an account with
 * real order history.
 */
export function parseOrderHistory(html: string, baseUrl: string): OrderSummary[] {
  const $ = cheerio.load(html);
  const orders: OrderSummary[] = [];
  const seen = new Set<string>();

  // Order rows link to the order detail page.
  $('a[href*="/muj-ucet/objednavky/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const idMatch = href.match(/\/muj-ucet\/objednavky\/(\d+)/);
    if (!idMatch || seen.has(idMatch[1])) return;
    seen.add(idMatch[1]);

    const row = $(el).closest('li,tr,article,div');
    const rowText = cleanText(row.text());
    const dateMatch = rowText.match(/\d{1,2}\.\s?\d{1,2}\.\s?\d{4}/);
    const totalMatch = rowText.match(/[\d\s]+(?:[.,]\d+)?\s*(?:Kč|€)/);

    orders.push({
      id: idMatch[1],
      url: new URL(href, baseUrl).href,
      date: dateMatch?.[0],
      total: totalMatch ? cleanText(totalMatch[0]) : undefined,
      itemsSummary: rowText.slice(0, 200) || undefined,
    });
  });

  return orders;
}

/** True when the page shows the "no orders yet" empty state. */
export function isOrderHistoryEmpty(html: string): boolean {
  return html.includes('Zatím nemáte žádné objednávky');
}
