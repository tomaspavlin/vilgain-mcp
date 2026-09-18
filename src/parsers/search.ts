import * as cheerio from 'cheerio';
import { SearchProduct } from '../types.js';
import { cleanText, parsePriceText, parseRatingText } from './common.js';

/** Parse product cards from a search results (or category listing) page. */
export function parseSearchResults(html: string, baseUrl: string): SearchProduct[] {
  const $ = cheerio.load(html);
  const products: SearchProduct[] = [];
  const seen = new Set<number>();

  $('.c-product-box').each((_, el) => {
    const box = $(el);
    const productId = parseInt(box.attr('data-item-id') ?? '', 10);
    if (Number.isNaN(productId) || seen.has(productId)) return;

    const href = box.find('a.c-product-box__link').attr('href');
    if (!href) return;
    seen.add(productId);

    const priceText = box.find('.c-product-box__price--main').first().text();
    const price = parsePriceText(priceText);
    const rating = parseRatingText(box.find('.c-product-box__rating .sr-only').first().text());

    products.push({
      productId,
      name: box.attr('data-item-name') ?? cleanText(box.find('.c-product-box__title').first().text()),
      subtitle: cleanText(box.find('.c-product-box__subtitle').first().text()).replace(/^[–-]\s*/, '') || undefined,
      defaultVariant: cleanText(box.find('.c-product-box__param').first().text()) || undefined,
      url: new URL(href, baseUrl).href,
      price: price?.price,
      currency: price?.currency,
      rating: rating?.rating,
      reviewCount: rating?.reviewCount,
    });
  });

  return products;
}
