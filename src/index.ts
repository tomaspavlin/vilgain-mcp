#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { VilgainAPI } from './vilgain-api.js';
import { createCartTools } from './tools/cart.js';
import { createOrderHistoryTools } from './tools/order-history.js';
import { createProductDetailTool } from './tools/product-detail.js';
import { createProductVariantsTool } from './tools/product-variants.js';
import { createSearchProductsTool } from './tools/search-products.js';

const email = process.env.VILGAIN_EMAIL;
const password = process.env.VILGAIN_PASSWORD;
const baseUrl = process.env.VILGAIN_BASE_URL || 'https://vilgain.cz';

if (!email || !password) {
  console.error('VILGAIN_EMAIL and VILGAIN_PASSWORD environment variables are required');
  process.exit(1);
}

// One shared API instance so the login session is reused across tool calls.
const api = new VilgainAPI({ email, password }, baseUrl);

const server = new McpServer({
  name: 'vilgain-mcp',
  version: '0.1.0',
});

const searchProducts = createSearchProductsTool(api);
const productVariants = createProductVariantsTool(api);
const productDetail = createProductDetailTool(api);
const cartTools = createCartTools(api);
const orderTools = createOrderHistoryTools(api);

server.registerTool(searchProducts.name, searchProducts.definition, searchProducts.handler);
server.registerTool(productVariants.name, productVariants.definition, productVariants.handler);
server.registerTool(productDetail.name, productDetail.definition, productDetail.handler);
server.registerTool(cartTools.getCartContent.name, cartTools.getCartContent.definition, cartTools.getCartContent.handler);
server.registerTool(cartTools.addToCart.name, cartTools.addToCart.definition, cartTools.addToCart.handler);
server.registerTool(
  cartTools.setCartItemQuantity.name,
  cartTools.setCartItemQuantity.definition,
  cartTools.setCartItemQuantity.handler
);
server.registerTool(cartTools.removeFromCart.name, cartTools.removeFromCart.definition, cartTools.removeFromCart.handler);
server.registerTool(orderTools.getOrderHistory.name, orderTools.getOrderHistory.definition, orderTools.getOrderHistory.handler);
server.registerTool(orderTools.getOrderDetail.name, orderTools.getOrderDetail.definition, orderTools.getOrderDetail.handler);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Vilgain MCP server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
