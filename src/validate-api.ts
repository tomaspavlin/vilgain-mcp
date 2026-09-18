#!/usr/bin/env node
/**
 * Live smoke test against the real Vilgain website.
 * Run with `npm run validate-api` (requires credentials in .env).
 *
 * Exercises every API method end to end and cleans up after itself
 * (anything it adds to the cart is removed again).
 */

import { VilgainAPI } from './vilgain-api.js';

const email = process.env.VILGAIN_EMAIL;
const password = process.env.VILGAIN_PASSWORD;

if (!email || !password) {
  console.error('VILGAIN_EMAIL and VILGAIN_PASSWORD are required (put them in .env)');
  process.exit(1);
}

const api = new VilgainAPI({ email, password }, process.env.VILGAIN_BASE_URL || 'https://vilgain.cz');

let failures = 0;

async function step<T>(name: string, fn: () => Promise<T>): Promise<T | undefined> {
  try {
    const result = await fn();
    console.log(`✓ ${name}`);
    return result;
  } catch (error) {
    failures++;
    console.error(`✗ ${name}: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

await step('login', () => api.login());

const products = await step('searchProducts("protein")', async () => {
  const results = await api.searchProducts('protein', 5);
  assert(results.length > 0, 'no search results');
  assert(results[0].url.startsWith('http'), 'missing product url');
  assert(results[0].price !== undefined, 'missing price');
  assert(results[0].variantId !== undefined, 'missing displayed variant id');
  return results;
});

const detail = products
  ? await step(`getProductDetail(${products[0].name})`, async () => {
      const d = await api.getProductDetail(products[0].url);
      assert(d.variants.length > 0, 'no variants parsed');
      assert(d.ingredients, 'no ingredients parsed');
      assert(d.nutrition.length > 0, 'no nutrition table parsed');
      return d;
    })
  : undefined;

if (detail && products) {
  const otherVariant = detail.variants.find((v) => v.inStock && v.variantId !== detail.selectedVariantId);
  if (otherVariant) {
    await step(`getProductDetail(variant ${otherVariant.variantId})`, async () => {
      const variantDetail = await api.getProductDetail(products[0].url, otherVariant.variantId);
      assert(variantDetail.selectedVariantId === otherVariant.variantId, 'wrong variant selected');
      assert(variantDetail.ingredients, 'no ingredients for variant');
    });
  }
}

const variant = detail?.variants.find((v) => v.inStock);
if (variant) {
  await step(`addToCart(${variant.variantId} = ${variant.name}, quantity 2)`, async () => {
    const cart = await api.addToCart(variant.variantId, 2);
    const item = cart.items.find((i) => i.variantId === variant.variantId);
    assert(item, 'item not in cart after add');
  });

  await step(`setCartItemQuantity(${variant.variantId}, 1)`, async () => {
    const cart = await api.setCartItemQuantity(variant.variantId, 1);
    const item = cart.items.find((i) => i.variantId === variant.variantId);
    assert(item?.quantity === 1, `expected quantity 1, got ${item?.quantity}`);
  });

  await step(`removeFromCart(${variant.variantId})`, async () => {
    const cart = await api.removeFromCart(variant.variantId);
    assert(!cart.items.some((i) => i.variantId === variant.variantId), 'item still in cart after remove');
  });
}

await step('getCart', async () => {
  await api.getCart();
});

const history = await step('getOrderHistory', async () => api.getOrderHistory());

if (history && history.orders.length > 0) {
  await step(`getOrderDetail(${history.orders[0].id})`, async () => {
    const detail = await api.getOrderDetail(history.orders[0].id);
    assert(detail.orderNumber === history.orders[0].id, 'order number mismatch');
    assert(detail.items.length > 0, 'no items parsed');
    assert(detail.totalWithVat !== undefined, 'no total parsed');
    assert(detail.timeline.length > 0, 'no timeline parsed');
  });
} else {
  console.log('- getOrderDetail skipped (account has no orders)');
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
