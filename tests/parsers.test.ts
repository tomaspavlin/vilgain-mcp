import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCart } from '../src/parsers/cart.js';
import { isOrderHistoryEmpty, parseOrderDetail, parseOrderHistory } from '../src/parsers/orders.js';
import { parseProductDetail, variantIdFromUrl } from '../src/parsers/product.js';
import { parseSearchResults } from '../src/parsers/search.js';

const BASE_URL = 'https://vilgain.cz';

function fixture(name: string): string {
  return readFileSync(join(__dirname, 'fixtures', name), 'utf-8');
}

describe('parseSearchResults', () => {
  const products = parseSearchResults(fixture('search-page.html'), BASE_URL);

  it('finds products', () => {
    expect(products.length).toBeGreaterThan(10);
  });

  it('parses the first product completely', () => {
    const first = products[0];
    expect(first.productId).toBe(62369);
    expect(first.name).toBe('Whey Protein');
    expect(first.url).toBe('https://vilgain.cz/vilgain-whey-protein-2');
    expect(first.price).toBe(999);
    expect(first.currency).toBe('CZK');
    expect(first.defaultVariant).toContain('Čokoláda');
    expect(first.rating).toBe('4.6/5');
    expect(first.reviewCount).toBe(425);
  });

  it('does not return duplicates', () => {
    const ids = products.map((p) => p.productId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('resolves displayed variant ids from analytics data', () => {
    expect(products[0].variantId).toBe(44471);
    // Most cards should resolve, even past non-product entries in the analytics list.
    const resolved = products.filter((p) => p.variantId !== undefined);
    expect(resolved.length).toBeGreaterThan(products.length - 5);
    // A resolved variant id never collides with another product's id.
    const ids = resolved.map((p) => p.variantId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('parseProductDetail', () => {
  const detail = parseProductDetail(
    fixture('product-page.html'),
    'https://vilgain.cz/vilgain-whey-protein-2/cokolada-1-000-g-44471'
  );

  it('parses name and description', () => {
    expect(detail.name).toBe('Whey Protein');
    expect(detail.shortDescription).toContain('Syrovátka');
  });

  it('parses variants with ids and prices', () => {
    expect(detail.variants.length).toBeGreaterThan(10);
    const chocolate = detail.variants.find((v) => v.variantId === 44471);
    expect(chocolate).toBeDefined();
    expect(chocolate!.price).toBe(999);
    expect(chocolate!.currency).toBe('CZK');
    expect(chocolate!.inStock).toBe(true);
  });

  it('resolves variant names', () => {
    const named = detail.variants.filter((v) => /g$/.test(v.name));
    expect(named.length).toBeGreaterThan(0);
  });

  it('parses ingredients for the selected variant', () => {
    expect(detail.ingredients).toContain('syrovátkový proteinový koncentrát');
    expect(detail.ingredients).toContain('Alergeny');
  });

  it('parses nutrition tables', () => {
    expect(detail.nutrition.length).toBeGreaterThan(0);
    const table = detail.nutrition[0];
    expect(table.columns).toEqual(['100 g', '30 g']);
    const protein = table.rows.find((r) => r.label === 'Bílkoviny');
    expect(protein).toBeDefined();
    expect(protein!.values[0]).toMatch(/^\d+ g$/);
  });

  it('parses dosage', () => {
    expect(detail.dosage).toContain('odměrku');
  });

  it('identifies the selected variant', () => {
    expect(detail.selectedVariantId).toBe(44471);
  });
});

describe('parseCart', () => {
  const cart = parseCart(fixture('cart-page.html'));

  it('parses cart items', () => {
    expect(cart.items.length).toBe(5);
    const whey = cart.items.find((i) => i.variantId === 44471);
    expect(whey).toBeDefined();
    expect(whey!.productName).toBe('Whey Protein');
    expect(whey!.quantity).toBe(1);
    expect(whey!.price).toBe(999);
    expect(whey!.currency).toBe('CZK');
  });

  it('parses cart total', () => {
    expect(cart.totalWithVat).toBe(1835);
    expect(cart.currency).toBe('CZK');
  });

  it('returns an empty cart for a page without cart data', () => {
    expect(parseCart('<html><body></body></html>').items).toEqual([]);
  });
});

describe('parseOrderHistory', () => {
  it('detects the empty state', () => {
    const html = fixture('orders-page-empty.html');
    expect(isOrderHistoryEmpty(html)).toBe(true);
    expect(parseOrderHistory(html, BASE_URL)).toEqual([]);
  });

  it('parses order rows', () => {
    const orders = parseOrderHistory(fixture('orders-page.html'), BASE_URL);
    expect(orders.length).toBe(10);

    const first = orders[0];
    expect(first.id).toBe('6661651');
    expect(first.url).toBe('https://vilgain.cz/muj-ucet/objednavka/6661651');
    expect(first.date).toBe('2026-08-06');
    expect(first.state).toBe('Vyřízeno');
    expect(first.total).toBe(837);
    expect(first.currency).toBe('CZK');
    expect(first.productNames.length).toBeGreaterThan(0);
    expect(first.productNames.join(' ')).toContain('Mandlové máslo');
  });
});

describe('parseOrderDetail', () => {
  const detail = parseOrderDetail(fixture('order-detail-page.html'), BASE_URL);

  it('parses order number and total', () => {
    expect(detail.orderNumber).toBe('6661651');
    expect(detail.totalWithVat).toBe(837);
    expect(detail.currency).toBe('CZK');
  });

  it('parses items without duplicates', () => {
    // 5 products + a discount voucher line
    expect(detail.items.length).toBe(6);
    expect(detail.items.at(-1)!.name).toContain('Poukaz');
    const almondButter = detail.items.find((i) => i.name.includes('Mandlové máslo'));
    expect(almondButter).toBeDefined();
    expect(almondButter!.variant).toContain('křupavé mandle');
    expect(almondButter!.quantity).toBe(1);
    expect(almondButter!.price).toBe(186);
    expect(almondButter!.url).toContain('/vilgain-mandlove-maslo');
    expect(almondButter!.variantId).toBe(46122);
  });

  it('parses the shipment timeline', () => {
    expect(detail.timeline.length).toBeGreaterThanOrEqual(5);
    expect(detail.timeline[0].event).toBe('Objednávka doručena, děkujeme');
    expect(detail.timeline[0].date).toBe('11. 08. 2026 16:14');
    expect(detail.timeline.at(-1)!.event).toBe('Objednávka vytvořena');
  });

  it('parses the delivery destination', () => {
    expect(detail.deliveryAddress).toContain('Thámova');
  });
});

describe('variantIdFromUrl', () => {
  it('extracts the trailing variant id', () => {
    expect(variantIdFromUrl('https://vilgain.cz/vilgain-whey-protein-2/cokolada-1-000-g-44471')).toBe(44471);
    expect(variantIdFromUrl('https://vilgain.cz/vilgain-whey-protein-2')).toBe(2);
  });
});
