import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import { NutritionTable, ProductDetail, ProductVariant } from '../types.js';
import { cleanText, findDataLayerObject, parseRatingText } from './common.js';

/** Extract the numeric variant id from a variant URL like ".../cokolada-1-000-g-44471". */
export function variantIdFromUrl(url: string): number | undefined {
  const match = url.match(/-(\d+)(?:[?#]|$)/);
  return match ? parseInt(match[1], 10) : undefined;
}

interface JsonLdOffer {
  url?: string;
  price?: number;
  priceCurrency?: string;
  availability?: string;
  gtin?: string;
}

interface JsonLdProduct {
  '@type'?: string;
  name?: string;
  description?: string;
  offers?: { offers?: JsonLdOffer[] } & JsonLdOffer;
}

function findProductJsonLd($: cheerio.CheerioAPI): JsonLdProduct | undefined {
  for (const el of $('script[type="application/ld+json"]').toArray()) {
    try {
      const data = JSON.parse($(el).text());
      if (data['@type'] === 'Product') return data as JsonLdProduct;
    } catch {
      // skip malformed JSON-LD
    }
  }
  return undefined;
}

interface DataLayerVariant {
  id: number;
  priceVat: number;
  variant: string;
  availability: boolean;
}

interface ProductDataLayer {
  productVariants: Record<string, DataLayerVariant>;
  currencyCode?: string;
}

/** The product page embeds all variants (id, name, price, availability) as analytics data. */
function extractVariantsData(html: string): ProductDataLayer | undefined {
  return findDataLayerObject<ProductDataLayer>(
    html,
    (obj) => typeof obj.productVariants === 'object' && obj.productVariants !== null && obj.pageType === 'product'
  );
}

/** Id of the variant the page content (ingredients, nutrition) refers to. */
function extractSelectedVariantId(html: string): number | undefined {
  const viewItem = findDataLayerObject<{ item_id: number }>(
    html,
    (obj) => obj.event === 'view_item' && typeof obj.item_id === 'number'
  );
  return viewItem?.item_id;
}

/**
 * Product pages contain content blocks (ingredients, nutrition tables, dosage)
 * for every variant. The mapping of variant -> visible blocks is encoded in the
 * variant radio buttons' `data-nette-rules` toggle maps, e.g.
 * `"toggle":{"content-44471":true,"content-<uuid>":true,...}`.
 * Returns the set of "content-<uuid>" toggle keys for the given variant.
 */
function contentTogglesForVariant(html: string, variantId: number): Set<string> {
  const toggles = new Set<string>();
  const toggleRegex = /"toggle":\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = toggleRegex.exec(html)) !== null) {
    const body = match[1].replace(/&quot;/g, '"');
    if (!body.includes(`"content-${variantId}"`)) continue;
    for (const keyMatch of body.matchAll(/"(content-[0-9a-f-]{36})"/g)) {
      toggles.add(keyMatch[1]);
    }
  }
  return toggles;
}

function parseNutritionTable($: cheerio.CheerioAPI, table: Element): NutritionTable | undefined {
  const rows = $(table).find('tr').toArray();
  if (rows.length < 2) return undefined;

  const headerCells = $(rows[0]).find('td,th').toArray().map((c) => cleanText($(c).text()));
  const columns = headerCells.slice(1).filter((c) => c !== '');

  const dataRows = rows.slice(1).map((row) => {
    const cells = $(row).find('td,th').toArray().map((c) => cleanText($(c).text()));
    return { label: cells[0] ?? '', values: cells.slice(1) };
  }).filter((row) => row.label !== '');

  if (columns.length === 0 || dataRows.length === 0) return undefined;
  return { columns, rows: dataRows };
}

/**
 * Select the content blocks within a tab that belong to the given variant
 * (a variant typically has separate blocks for ingredients and nutrition tables).
 * Falls back to the first content block when no toggle map matches
 * (e.g. single-variant products have no toggles at all).
 */
function variantBlocks($: cheerio.CheerioAPI, tab: cheerio.Cheerio<Element>, toggles: Set<string>): cheerio.Cheerio<Element> {
  const toggled = tab.find('[data-toggle]');
  if (toggled.length === 0) return tab;
  const matching = toggled.filter((_, el) => toggles.has($(el).attr('data-toggle') ?? ''));
  return matching.length > 0 ? matching : toggled.first();
}

/** Parse a product detail page. `finalUrl` must be the URL after redirects (it identifies the selected variant). */
export function parseProductDetail(html: string, finalUrl: string): ProductDetail {
  const $ = cheerio.load(html);
  const jsonLd = findProductJsonLd($);
  const name = jsonLd?.name ?? cleanText($('h1').first().text());
  // <noscript> fallback images and inline styles/scripts would otherwise leak into extracted text.
  $('noscript, style, script').remove();

  // JSON-LD offers provide per-variant URLs and GTINs.
  const offers = jsonLd?.offers?.offers ?? (jsonLd?.offers ? [jsonLd.offers] : []);
  const offersByVariantId = new Map<number, JsonLdOffer>();
  for (const offer of offers) {
    const variantId = offer.url ? variantIdFromUrl(offer.url) : undefined;
    if (variantId !== undefined) offersByVariantId.set(variantId, offer);
  }

  const variantsData = extractVariantsData(html);
  const currency = variantsData?.currencyCode ?? 'CZK';
  const variants: ProductVariant[] = Object.values(variantsData?.productVariants ?? {}).map((v) => {
    const offer = offersByVariantId.get(v.id);
    return {
      variantId: v.id,
      name: cleanText(v.variant),
      url: offer?.url ?? finalUrl,
      price: v.priceVat,
      currency,
      inStock: v.availability,
      gtin: offer?.gtin,
    };
  });

  const selectedVariantId = extractSelectedVariantId(html);
  const toggles = selectedVariantId !== undefined ? contentTogglesForVariant(html, selectedVariantId) : new Set<string>();

  const ingredientsBlocks = variantBlocks($, $('#slozeni'), toggles);
  const nutrition: NutritionTable[] = [];
  ingredientsBlocks.find('table').each((_, table) => {
    const parsed = parseNutritionTable($, table);
    if (parsed) nutrition.push(parsed);
  });
  // Blocks without tables hold the ingredients text; table blocks hold nutrition facts.
  const textBlocks = ingredientsBlocks.filter((_, el) => $(el).find('table').length === 0);
  const ingredients =
    cleanText((textBlocks.length > 0 ? textBlocks : ingredientsBlocks.find('table').remove().end()).text()) || undefined;

  const dosageBlock = variantBlocks($, $('#davkovani'), toggles);
  const dosage = cleanText(dosageBlock.text()) || undefined;

  const description = cleanText($('#popis').first().text()) || undefined;

  const ratingText = $('.sr-only').toArray()
    .map((el) => $(el).text())
    .find((t) => /\/5,/.test(t));
  const rating = ratingText ? parseRatingText(ratingText) : undefined;

  return {
    name,
    url: finalUrl,
    shortDescription: jsonLd?.description,
    description,
    ingredients,
    dosage,
    nutrition,
    rating: rating?.rating,
    reviewCount: rating?.reviewCount,
    variants,
    selectedVariantId,
  };
}
