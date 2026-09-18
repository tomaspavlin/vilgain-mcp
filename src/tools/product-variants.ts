import { z } from 'zod';
import { VilgainAPI } from '../vilgain-api.js';
import { errorResult, textResult } from './helpers.js';

export function createProductVariantsTool(api: VilgainAPI) {
  return {
    name: 'get_product_variants',
    definition: {
      title: 'Get Product Variants',
      description:
        'List all purchasable variants (flavors/sizes) of a Vilgain product with prices, availability and variant IDs. ' +
        'Use this to pick a variant before add_to_cart. For ingredients and nutrition facts use get_product_detail instead.',
      inputSchema: {
        product_url: z
          .string()
          .min(1)
          .describe('Product URL from search_products, e.g. "https://vilgain.cz/vilgain-whey-protein-2"'),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: true,
      },
    },
    handler: async ({ product_url }: { product_url: string }) => {
      try {
        const detail = await api.getProductDetail(product_url);
        if (detail.variants.length === 0) {
          return textResult(`No variants found for ${detail.name} - the product may be unavailable.`);
        }
        const variants = detail.variants
          .map((v) => {
            const stock = v.inStock ? '' : ' | OUT OF STOCK';
            return `• ${v.name} – ${v.price} ${v.currency}${stock}\n  Variant ID: ${v.variantId}`;
          })
          .join('\n');
        return textResult(`# ${detail.name}\n\nVariants (use Variant ID with add_to_cart):\n${variants}`);
      } catch (error) {
        return errorResult(error);
      }
    },
  };
}
