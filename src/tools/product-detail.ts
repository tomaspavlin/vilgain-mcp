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
        'Get what is inside a Vilgain product: ingredients (with allergens), nutrition facts, dosage and description. ' +
        'Without variant_id it describes the product\'s default variant; pass variant_id (from search_products, ' +
        'get_product_variants or get_order_detail) to inspect a specific flavor/size. ' +
        'For the list of variants and prices use get_product_variants instead.',
      inputSchema: {
        product_url: z
          .string()
          .min(1)
          .describe('Product or variant URL, e.g. "https://vilgain.cz/vilgain-whey-protein-2"'),
        variant_id: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Optional variant ID to get the content of a specific flavor/size of this product'),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: true,
      },
    },
    handler: async ({ product_url, variant_id }: { product_url: string; variant_id?: number }) => {
      try {
        const detail = await api.getProductDetail(product_url, variant_id);

        const sections: string[] = [];
        sections.push(`# ${detail.name}`);
        const selected = detail.variants.find((v) => v.variantId === detail.selectedVariantId);
        if (selected) sections.push(`Content below refers to variant: ${selected.name} (Variant ID: ${selected.variantId})`);
        if (detail.rating) sections.push(`Rating: ${detail.rating} (${detail.reviewCount} reviews)`);
        if (detail.shortDescription) sections.push(detail.shortDescription);

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
