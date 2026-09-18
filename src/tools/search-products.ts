import { z } from 'zod';
import { VilgainAPI } from '../vilgain-api.js';
import { errorResult, textResult } from './helpers.js';

export function createSearchProductsTool(api: VilgainAPI) {
  return {
    name: 'search_products',
    definition: {
      title: 'Search Products',
      description:
        'Search for products on Vilgain by name or keyword. Returns product names, prices, ratings, product URLs and ' +
        'the Variant ID of the displayed variant, which can be passed directly to add_to_cart. ' +
        'To pick a different flavor/size, call get_product_variants with the product URL first.',
      inputSchema: {
        query: z.string().min(1).describe('Search term, e.g. "whey protein" or "arašídové máslo"'),
        limit: z.number().int().min(1).max(30).default(10).describe('Maximum number of results (default 10)'),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: true,
      },
    },
    handler: async ({ query, limit }: { query: string; limit?: number }) => {
      try {
        const products = await api.searchProducts(query, limit ?? 10);
        if (products.length === 0) {
          return textResult(`No products found for "${query}".`);
        }
        const output = products
          .map((p) => {
            const price = p.price !== undefined ? `${p.price} ${p.currency}` : 'price unavailable';
            const rating = p.rating ? ` | Rating: ${p.rating} (${p.reviewCount} reviews)` : '';
            const variant = p.defaultVariant ? ` | Shown variant: ${p.defaultVariant}` : '';
            const variantId = p.variantId !== undefined ? `\n  Variant ID (shown variant): ${p.variantId}` : '';
            return `• ${p.name}${p.subtitle ? ` – ${p.subtitle}` : ''}\n  Price: ${price}${variant}${rating}${variantId}\n  URL: ${p.url}`;
          })
          .join('\n\n');
        return textResult(`Found ${products.length} products for "${query}":\n\n${output}`);
      } catch (error) {
        return errorResult(error);
      }
    },
  };
}
