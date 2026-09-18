import { z } from 'zod';
import { NutritionTable } from '../types.js';
import { VilgainAPI } from '../vilgain-api.js';
import { errorResult, textResult } from './helpers.js';

function formatNutritionTable(table: NutritionTable): string {
  const header = `  | ${['', ...table.columns].join(' | ')} |`;
  const rows = table.rows.map((row) => `  | ${[row.label, ...row.values].join(' | ')} |`);
  return [header, ...rows].join('\n');
}

export function createProductDetailTool(api: VilgainAPI) {
  return {
    name: 'get_product_detail',
    definition: {
      title: 'Get Product Detail',
      description:
        'Get full details of a Vilgain product: description, ingredients (with allergens), nutrition facts, ' +
        'dosage and all purchasable variants (flavors/sizes) with prices and variant IDs. ' +
        'Use the variant ID with add_to_cart. Ingredients and nutrition facts refer to the variant selected by the URL; ' +
        'pass a specific variant URL to inspect a different flavor.',
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

        const sections: string[] = [];
        sections.push(`# ${detail.name}`);
        if (detail.rating) sections.push(`Rating: ${detail.rating} (${detail.reviewCount} reviews)`);
        if (detail.shortDescription) sections.push(detail.shortDescription);

        if (detail.variants.length > 0) {
          const variants = detail.variants
            .map((v) => {
              const stock = v.inStock ? '' : ' | OUT OF STOCK';
              return `• ${v.name} – ${v.price} ${v.currency}${stock}\n  Variant ID: ${v.variantId}`;
            })
            .join('\n');
          sections.push(`## Variants (use Variant ID with add_to_cart)\n${variants}`);
        }

        if (detail.ingredients) sections.push(`## Ingredients & allergens\n${detail.ingredients}`);
        if (detail.nutrition.length > 0) {
          sections.push(`## Nutrition facts\n${detail.nutrition.map(formatNutritionTable).join('\n\n')}`);
        }
        if (detail.dosage) sections.push(`## Dosage\n${detail.dosage}`);
        if (detail.description) sections.push(`## Description\n${detail.description}`);
        sections.push(`URL: ${detail.url}`);

        return textResult(sections.join('\n\n'));
      } catch (error) {
        return errorResult(error);
      }
    },
  };
}
