import { z } from 'zod';
import { VilgainAPI } from '../vilgain-api.js';
import { errorResult, formatCart, textResult } from './helpers.js';

export function createCartTools(api: VilgainAPI) {
  const getCartContent = {
    name: 'get_cart_content',
    definition: {
      title: 'Get Cart Content',
      description: 'Show the current content of the Vilgain shopping cart: items, quantities, prices and the total.',
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        openWorldHint: true,
      },
    },
    handler: async () => {
      try {
        return textResult(formatCart(await api.getCart()));
      } catch (error) {
        return errorResult(error);
      }
    },
  };

  const addToCart = {
    name: 'add_to_cart',
    definition: {
      title: 'Add to Cart',
      description:
        'Add a product variant to the Vilgain shopping cart. Requires a variant ID from get_product_detail ' +
        '(a variant is a specific flavor + size). Adds the given quantity on top of what is already in the cart. ' +
        'Returns the updated cart.',
      inputSchema: {
        variant_id: z.number().int().positive().describe('Variant ID from get_product_detail'),
        quantity: z.number().int().min(1).max(100).default(1).describe('How many pieces to add (default 1)'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    handler: async ({ variant_id, quantity }: { variant_id: number; quantity?: number }) => {
      try {
        const cart = await api.addToCart(variant_id, quantity ?? 1);
        return textResult(`Added to cart.\n\n${formatCart(cart)}`);
      } catch (error) {
        return errorResult(error);
      }
    },
  };

  const setCartItemQuantity = {
    name: 'set_cart_item_quantity',
    definition: {
      title: 'Set Cart Item Quantity',
      description:
        'Set the exact quantity of an item already in the Vilgain cart (use variant IDs from get_cart_content). ' +
        'Returns the updated cart.',
      inputSchema: {
        variant_id: z.number().int().positive().describe('Variant ID of an item in the cart'),
        quantity: z.number().int().min(1).max(100).describe('New absolute quantity'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    handler: async ({ variant_id, quantity }: { variant_id: number; quantity: number }) => {
      try {
        const cart = await api.setCartItemQuantity(variant_id, quantity);
        return textResult(`Quantity updated.\n\n${formatCart(cart)}`);
      } catch (error) {
        return errorResult(error);
      }
    },
  };

  const removeFromCart = {
    name: 'remove_from_cart',
    definition: {
      title: 'Remove from Cart',
      description:
        'Remove an item from the Vilgain shopping cart (use variant IDs from get_cart_content). Returns the updated cart.',
      inputSchema: {
        variant_id: z.number().int().positive().describe('Variant ID of the item to remove'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
      },
    },
    handler: async ({ variant_id }: { variant_id: number }) => {
      try {
        const cart = await api.removeFromCart(variant_id);
        return textResult(`Item removed.\n\n${formatCart(cart)}`);
      } catch (error) {
        return errorResult(error);
      }
    },
  };

  return { getCartContent, addToCart, setCartItemQuantity, removeFromCart };
}
