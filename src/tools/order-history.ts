import { z } from 'zod';
import { VilgainAPI } from '../vilgain-api.js';
import { errorResult, textResult } from './helpers.js';

export function createOrderHistoryTools(api: VilgainAPI) {
  const getOrderHistory = {
    name: 'get_order_history',
    definition: {
      title: 'Get Order History',
      description:
        'List past orders of the logged-in Vilgain account: order ID, date, state, total and product names. ' +
        'Use get_order_detail with an order ID for quantities, prices and delivery status.',
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        openWorldHint: true,
      },
    },
    handler: async () => {
      try {
        const { orders, empty } = await api.getOrderHistory();
        if (empty || orders.length === 0) {
          return textResult('No past orders found on this account.');
        }
        const output = orders
          .map((order) => {
            const header = [
              `• Order ${order.id}`,
              order.date,
              order.state,
              order.total !== undefined ? `${order.total} ${order.currency}` : undefined,
            ]
              .filter(Boolean)
              .join(' | ');
            const products = order.productNames.length > 0 ? `\n  Products: ${order.productNames.join(', ')}` : '';
            return header + products;
          })
          .join('\n\n');
        return textResult(`Found ${orders.length} orders (most recent first):\n\n${output}`);
      } catch (error) {
        return errorResult(error);
      }
    },
  };

  const getOrderDetail = {
    name: 'get_order_detail',
    definition: {
      title: 'Get Order Detail',
      description:
        'Get one past order of the logged-in Vilgain account: items with variants, quantities, prices and ' +
        'variant IDs (usable with add_to_cart to reorder), order total, delivery destination and shipment status timeline.',
      inputSchema: {
        order_id: z.string().regex(/^\d+$/).describe('Order ID from get_order_history'),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: true,
      },
    },
    handler: async ({ order_id }: { order_id: string }) => {
      try {
        const detail = await api.getOrderDetail(order_id);

        const sections: string[] = [`# Order ${detail.orderNumber}`];

        if (detail.items.length > 0) {
          const items = detail.items
            .map((item) => {
              const parts = [
                item.variant,
                item.quantity !== undefined ? `${item.quantity} pcs` : undefined,
                item.price !== undefined ? `${item.price} ${item.currency}` : undefined,
              ].filter(Boolean);
              const variantId = item.variantId !== undefined ? `\n  Variant ID (for add_to_cart): ${item.variantId}` : '';
              return `• ${item.name}${parts.length > 0 ? ` (${parts.join(', ')})` : ''}${variantId}${item.url ? `\n  URL: ${item.url}` : ''}`;
            })
            .join('\n');
          sections.push(`## Items\n${items}`);
        }

        if (detail.totalWithVat !== undefined) {
          sections.push(`Total (with VAT): ${detail.totalWithVat} ${detail.currency ?? ''}`.trimEnd());
        }
        if (detail.deliveryAddress) {
          sections.push(`Delivery: ${detail.deliveryAddress}`);
        }
        if (detail.timeline.length > 0) {
          sections.push(
            `## Status timeline\n${detail.timeline.map((e) => `• ${e.event}${e.date ? ` – ${e.date}` : ''}`).join('\n')}`
          );
        }

        return textResult(sections.join('\n\n'));
      } catch (error) {
        return errorResult(error);
      }
    },
  };

  return { getOrderHistory, getOrderDetail };
}
