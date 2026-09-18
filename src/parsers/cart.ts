import { CartContent, CartItem } from '../types.js';
import { findDataLayerObject } from './common.js';

interface CartDataLayerItem {
  item_id: number;
  item_name: string;
  quantity: number;
  price: number;
  currency: string;
  variant?: string | null;
  type?: string | null;
}

interface CartDataLayer {
  items: CartDataLayerItem[];
  total_value_with_vat?: number;
  currency?: string;
}

/**
 * Parse the cart page. The page embeds the cart as analytics data
 * (items with variant ids, names, quantities and prices), which is more
 * reliable than scraping the cart HTML.
 */
export function parseCart(html: string): CartContent {
  const cartData = findDataLayerObject<CartDataLayer>(
    html,
    (obj) => Array.isArray(obj.items) && 'total_value_with_vat' in obj
  );

  if (!cartData) {
    // A cart with no items has no cart analytics object.
    return { items: [] };
  }

  const items: CartItem[] = cartData.items.map((item) => ({
    variantId: item.item_id,
    productName: item.item_name,
    variant: [item.variant, item.type].filter(Boolean).join(' ') || undefined,
    quantity: item.quantity,
    price: item.price,
    currency: item.currency,
  }));

  return {
    items,
    totalWithVat: cartData.total_value_with_vat,
    currency: cartData.currency,
  };
}
