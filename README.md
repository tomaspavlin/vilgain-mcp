# <img src="https://vilgain.cz/favicon.ico" alt="Vilgain" width="30" height="30"> Vilgain MCP Server

**Let your favourite LLM shop for healthy food on [Vilgain.cz](https://vilgain.cz) (formerly Aktin).**

> [!WARNING]
> This MCP server is made for study purposes and uses the reverse engineered Vilgain website API. It is for personal use only.

This is a [Model Context Protocol](https://modelcontextprotocol.io) server that lets AI assistants search products, inspect ingredients and nutrition facts, and manage the shopping cart on Vilgain.

Because Vilgain focuses on clean-label food, the product detail tool exposes what matters there: **ingredients, allergens and full nutrition facts** — so you can shop by what's actually in the food.

Example prompts:

**🛒 Shopping**

- *Add whey protein and a jar of peanut butter to my cart. Pick well-rated ones.*
- *I'm making protein pancakes — put the ingredients in my cart, budget-friendly.*
- *What's in my cart right now and how much will it cost?*
- *Swap the chocolate flavor in my cart for vanilla.*

**🥗 Ingredients & nutrition**

- *Find a protein bar without sucralose and with at least 25 % protein.*
- *Pick the omega-3 supplement with the best price per 1 g of EPA+DHA.*
- *Compare the ingredients of Vilgain peanut butter and almond butter — which has the shorter ingredient list?*
- *How much protein per 100 g does the vanilla flavor have compared to chocolate?*
- *Does the Double Trouble bar contain any allergens I should worry about? I'm allergic to nuts.*
- *Find me a breakfast granola with no added sugar and check its actual ingredient list.*

**🔁 Reordering**

- *What did I buy in my last order?*
- *Order the same things as last time, but skip the turkey breast.*
- *When did my last order arrive and where did I pick it up?*

## Usage

### Claude Desktop / Claude Code configuration

Add the MCP to the Claude Desktop configuration file:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "vilgain": {
      "command": "npx",
      "args": ["-y", "@tomaspavlin/vilgain-mcp"],
      "env": {
        "VILGAIN_EMAIL": "your-email@example.com",
        "VILGAIN_PASSWORD": "your-password"
      }
    }
  }
}
```

For Claude Code: `claude mcp add vilgain -e VILGAIN_EMAIL=... -e VILGAIN_PASSWORD=... -- npx -y @tomaspavlin/vilgain-mcp`

### Configuration

| Variable | Required | Description |
|---|---|---|
| `VILGAIN_EMAIL` | yes | Vilgain account e-mail |
| `VILGAIN_PASSWORD` | yes | Vilgain account password |
| `VILGAIN_BASE_URL` | no | Store base URL, defaults to `https://vilgain.cz` |

### Supported regions

Vilgain operates in several countries. The server is developed and tested against the Czech store; other regions can be selected with `VILGAIN_BASE_URL` and may work since they run the same platform, but are untested:

* **Czech Republic**: `https://vilgain.cz` (default)
* **Slovakia**: `https://vilgain.sk` (untested)
* **Other countries** (`vilgain.com`, `vilgain.de`, ...): untested

## Tools

| Tool | Description |
|---|---|
| `search_products` | Full-text product search with prices, ratings and the displayed variant's ID |
| `get_product_variants` | All variants (flavors/sizes) of a product with prices and variant IDs |
| `get_product_detail` | What's inside: ingredients, allergens, nutrition facts, dosage, description |
| `get_cart_content` | Show cart items and total |
| `add_to_cart` | Add a product variant to the cart |
| `set_cart_item_quantity` | Change the quantity of a cart item |
| `remove_from_cart` | Remove an item from the cart |
| `get_order_history` | List past orders with dates, states, totals and product names |
| `get_order_detail` | One order's items, prices, delivery destination and shipment timeline |

`search_products` results can go straight to `add_to_cart` (the displayed variant); use `get_product_variants` to pick a different flavor or size. Checkout is intentionally not automated — finish the order yourself in the browser.

## Development

```bash
npm install
npm run build

npm test               # parser unit tests (offline, against HTML fixtures)
npm run validate-api   # live smoke test against vilgain.cz (needs credentials in .env)
npm run inspect        # open MCP Inspector to try the tools manually
```

Copy `.env.example` to `.env` and fill in your credentials for `validate-api` and `inspect`.

### Testing with Claude Desktop

To run a local build instead of the published package, point the config at `dist/index.js`:

```json
{
  "mcpServers": {
    "vilgain-local": {
      "command": "node",
      "args": ["/path/to/vilgain-mcp/dist/index.js"],
      "env": {
        "VILGAIN_EMAIL": "your-email@example.com",
        "VILGAIN_PASSWORD": "your-password"
      }
    }
  }
}
```

The server has three layers:

- `src/vilgain-api.ts` – HTTP client for the reverse engineered website endpoints (see [docs/api.md](docs/api.md))
- `src/parsers/` – pure functions that extract data from Vilgain HTML pages, unit-tested against fixtures
- `src/tools/` – thin MCP tool wrappers around the API client

## License

MIT
