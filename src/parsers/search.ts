import * as cheerio from 'cheerio';
import { SearchProduct } from '../types.js';
import { cleanText, findDataLayerObject, parsePriceText, parseRatingText } from './common.js';

interface ViewItemList {
  item_ids: Array<number | string>;
  item_names: string[];
}

/**
 * The search page's `view_item_list` analytics event lists the variant ids of
 * the displayed products in card order (with occasional extra non-product
 * entries like bundles). Zip it with the cards, matching by product name;
 * a card that cannot be matched safely just gets no variant id.
 */
function buildVariantIdLookup(html: string): (name: string) => number | undefined {
  const list = findDataLayerObject<ViewItemList>(
    html,
    (obj) => obj.event === 'view_item_list' && Array.isArray(obj.item_ids) && Array.isArray(obj.item_names)
  );
  if (!list) return () => undefined;

  let pointer = 0;
  const assigned = new Set<number>();
  return (name) => {
    // Skip non-product entries (their names don't match the card).
    let cursor = pointer;
    while (cursor < list.item_names.length && cleanText(list.item_names[cursor]) !== name) {
      cursor++;
    }
    if (cursor >= list.item_ids.length) return undefined;
    const id = list.item_ids[cursor];
    pointer = cursor + 1;
    // The analytics list can repeat an entry; never hand out the same id twice.
    if (typeof id !== 'number' || assigned.has(id)) return undefined;
    assigned.add(id);
    return id;
  };
}

/** Parse product cards from a search results (or category listing) page. */
export function parseSearchResults(html: string, baseUrl: string): SearchProduct[] {
  const $ = cheerio.load(html);
  const products: SearchProduct[] = [];
  const seen = new Set<number>();
  const variantIdFor = buildVariantIdLookup(html);

  $('.c-product-box').each((_, el) => {
    const box = $(el);
    const productId = parseInt(box.attr('data-item-id') ?? '', 10);
    if (Number.isNaN(productId) || seen.has(productId)) return;

    const href = box.find('a.c-product-box__link').attr('href');
    if (!href) return;
    seen.add(productId);

    const name = cleanText(box.attr('data-item-name') ?? box.find('.c-product-box__title').first().text());
    const priceText = box.find('.c-product-box__price--main').first().text();
    const price = parsePriceText(priceText);
    const rating = parseRatingText(box.find('.c-product-box__rating .sr-only').first().text());

    products.push({
      productId,
      name,
      subtitle: cleanText(box.find('.c-product-box__subtitle').first().text()).replace(/^[–-]\s*/, '') || undefined,
      defaultVariant: cleanText(box.find('.c-product-box__param').first().text()) || undefined,
      variantId: variantIdFor(name),
      url: new URL(href, baseUrl).href,
      price: price?.price,
      currency: price?.currency,
      rating: rating?.rating,
      reviewCount: rating?.reviewCount,
    });
  });

  return products;
}
