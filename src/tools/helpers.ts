import { CartContent } from '../types.js';

type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

export function textResult(text: string): ToolResult {
  return { content: [{ type: 'text', text }] };
}

export function errorResult(error: unknown): ToolResult {
  return {
    content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
    isError: true,
  };
}

export function formatCart(cart: CartContent): string {
  if (cart.items.length === 0) {
    return 'The cart is empty.';
  }
  const lines = cart.items.map((item) => {
    const variant = item.variant ? ` (${item.variant})` : '';
    return `• ${item.productName}${variant}\n  Quantity: ${item.quantity} × ${item.price} ${item.currency}\n  Variant ID: ${item.variantId}`;
  });
  const total =
    cart.totalWithVat !== undefined ? `\n\nTotal (with VAT): ${cart.totalWithVat} ${cart.currency ?? ''}`.trimEnd() : '';
  return `Cart (${cart.items.length} item${cart.items.length === 1 ? '' : 's'}):\n\n${lines.join('\n\n')}${total}`;
}
