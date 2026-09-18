import * as cheerio from 'cheerio';
import { OrderDetail, OrderItem, OrderSummary, OrderTimelineEvent } from '../types.js';
import { cleanText, parsePriceText } from './common.js';

/** Parse the order history page (/muj-ucet/objednavky). */
export function parseOrderHistory(html: string, baseUrl: string): OrderSummary[] {
  const $ = cheerio.load(html);
  const orders: OrderSummary[] = [];

  $('li.p-order-list-item').each((_, el) => {
    const row = $(el);
    const href = row.find('a[href*="/muj-ucet/objednavka/"]').first().attr('href');
    const idMatch = href?.match(/\/muj-ucet\/objednavka\/(\d+)/);
    if (!href || !idMatch) return;

    const total = parsePriceText(row.find('.p-order-list-item__info--price').first().text());
    const productNames = row
      .find('.c-product-image-list__item')
      .toArray()
      .map((item) => cleanText($(item).attr('data-bs-original-title') ?? ''))
      .filter((name) => name !== '');

    orders.push({
      id: idMatch[1],
      url: new URL(href, baseUrl).href,
      date: row.find('time').first().attr('datetime') ?? undefined,
      state: cleanText(row.find('.p-order-list-item__info--state').first().text()) || undefined,
      total: total?.price,
      currency: total?.currency,
      productNames,
    });
  });

  return orders;
}

/** True when the page shows the "no orders yet" empty state. */
export function isOrderHistoryEmpty(html: string): boolean {
  return html.includes('Zatím nemáte žádné objednávky');
}

/** Parse an order detail page (/muj-ucet/objednavka/<id>). */
export function parseOrderDetail(html: string, baseUrl: string): OrderDetail {
  const $ = cheerio.load(html);

  const orderNumber = cleanText($('.p-order-detail-status__title strong').first().text());

  const items: OrderItem[] = [];
  const seenItems = new Set<string>();
  $('.p-order-detail-item__item').each((_, el) => {
    const item = $(el);
    const title = item.find('.p-order-detail-item__text--title').first();
    const name = cleanText(title.text());
    if (!name) return;
    const variant = cleanText(item.find('.p-order-detail-item__params').first().text()) || undefined;
    // The page renders the item list twice (desktop and mobile layout).
    const key = `${name}|${variant ?? ''}`;
    if (seenItems.has(key)) return;
    seenItems.add(key);

    const quantityMatch = cleanText(item.find('.p-order-detail-item__column--count').first().text()).match(/(\d+)/);
    const price = parsePriceText(
      item.find('.p-order-detail-item__column').not('.p-order-detail-item__column--count').first().text()
    );
    const href = title.attr('href');

    items.push({
      name,
      variant,
      quantity: quantityMatch ? parseInt(quantityMatch[1], 10) : undefined,
      price: price?.price,
      currency: price?.currency,
      url: href ? new URL(href, baseUrl).href : undefined,
    });
  });

  const total = parsePriceText($('.p-order-detail-price__wrapper').first().text());

  const timeline: OrderTimelineEvent[] = [];
  $('.order-detail-watch__item').each((_, el) => {
    const text = cleanText($(el).text());
    if (!text) return;
    const match = text.match(/^(.*?)\s*(\d{2}\.\s?\d{2}\.\s?\d{4}(?:\s\d{2}:\d{2})?)?$/);
    const event = cleanText(match?.[1] ?? text);
    // Skip non-timeline content blocks that share the class prefix (e.g. payment info).
    if (!match?.[2]) return;
    timeline.push({ event, date: match[2] });
  });

  const deliveryAddress = cleanText(
    $('.p-order-detail-location__base').first().find('button, a').remove().end().text()
  ) || undefined;

  return {
    orderNumber,
    items,
    totalWithVat: total?.price,
    currency: total?.currency,
    timeline,
    deliveryAddress,
  };
}
