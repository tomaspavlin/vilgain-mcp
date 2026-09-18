export interface VilgainCredentials {
  email: string;
  password: string;
}

/** Product as listed in search results. One product groups multiple variants (flavors, sizes). */
export interface SearchProduct {
  /** Product group id (identifies the product family, not a purchasable variant) */
  productId: number;
  name: string;
  /** Short marketing description shown under the product name */
  subtitle?: string;
  /** Name of the variant the listed price refers to, e.g. "Čokoláda 1 000 g" */
  defaultVariant?: string;
  /** Variant id of the displayed variant, usable directly with add_to_cart (best-effort) */
  variantId?: number;
  /** Absolute URL of the product detail page */
  url: string;
  /** Current price of the default variant (VAT included) */
  price?: number;
  currency?: string;
  /** Rating like "4.6/5" */
  rating?: string;
  reviewCount?: number;
}

/** A purchasable product variant (specific flavor + size). */
export interface ProductVariant {
  /** Variant id used by cart operations */
  variantId: number;
  /** Variant name, e.g. "Čokoláda 1 000 g" */
  name: string;
  url: string;
  price: number;
  currency: string;
  inStock: boolean;
  gtin?: string;
}

export interface NutritionRow {
  /** e.g. "Energetická hodnota", "Bílkoviny" */
  label: string;
  /** Values in the same order as NutritionTable.columns */
  values: string[];
}

export interface NutritionTable {
  /** Column headers, e.g. ["100 g", "30 g"] */
  columns: string[];
  rows: NutritionRow[];
}

export interface ProductDetail {
  name: string;
  url: string;
  /** Marketing description from page metadata */
  shortDescription?: string;
  /** Full description text from the "Popis" tab */
  description?: string;
  /** Ingredients text including allergen notes (for the variant selected by the URL) */
  ingredients?: string;
  /** Dosage / usage instructions */
  dosage?: string;
  /** Nutrition facts tables (values per 100 g and per serving) */
  nutrition: NutritionTable[];
  rating?: string;
  reviewCount?: number;
  variants: ProductVariant[];
  /** Id of the variant the page content (ingredients, nutrition) refers to */
  selectedVariantId?: number;
}

export interface CartItem {
  variantId: number;
  productName: string;
  /** Variant name, e.g. "1 000 g" or "jahoda 1 000 g" */
  variant?: string;
  quantity: number;
  /** Unit price with VAT */
  price: number;
  currency: string;
}

export interface CartContent {
  items: CartItem[];
  /** Cart total with VAT */
  totalWithVat?: number;
  currency?: string;
}

export interface OrderSummary {
  /** Order id/number as displayed by the shop */
  id: string;
  url?: string;
  date?: string;
  state?: string;
  total?: string;
  /** Free-form summary of items if available on the list page */
  itemsSummary?: string;
}
