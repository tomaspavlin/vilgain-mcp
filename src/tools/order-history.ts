import { VilgainAPI } from '../vilgain-api.js';
import { errorResult, textResult } from './helpers.js';

export function createOrderHistoryTool(api: VilgainAPI) {
  return {
    name: 'get_order_history',
    definition: {
      title: 'Get Order History',
      description: 'List past orders of the logged-in Vilgain account (order ID, date, total).',
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
            const parts = [
              `• Order ${order.id}`,
              order.date ? `Date: ${order.date}` : undefined,
              order.total ? `Total: ${order.total}` : undefined,
              order.url ? `URL: ${order.url}` : undefined,
            ].filter(Boolean);
            return parts.join('\n  ');
          })
          .join('\n\n');
        return textResult(`Found ${orders.length} orders:\n\n${output}`);
      } catch (error) {
        return errorResult(error);
      }
    },
  };
}
