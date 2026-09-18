# <img src="https://vilgain.cz/favicon.ico" alt="Vilgain" width="30" height="30"> Vilgain MCP Server

**Let your favourite LLM shop for healthy food on [Vilgain.cz](https://vilgain.cz) (formerly Aktin).**

> [!WARNING]
> This MCP server is made for study purposes and uses the reverse engineered Vilgain website API. It is for personal use only.

This is a [Model Context Protocol](https://modelcontextprotocol.io) server that lets AI assistants search products, inspect ingredients and nutrition facts, and manage the shopping cart on Vilgain.

Because Vilgain focuses on clean-label food, the product detail tool exposes what matters there: **ingredients, allergens and full nutrition facts** — so you can shop by what's actually in the food.

Example prompts:

- *Find a whey protein without sucralose and add the cheapest flavor to my cart.*
- *What's the protein content per 100 g of Vilgain peanut butter?*
- *Compare the ingredients of these two protein bars — which one has less sugar?*
- *Add ingredients for a high-protein breakfast to the cart, under 500 Kč total.*
- *What's in my cart right now?*

## Usage

### Claude Desktop / Claude Code configuration

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
| `VILGAIN_BASE_URL` | no | Store base URL, defaults to `https://vilgain.cz`. Other country stores (e.g. `https://vilgain.sk`) may work but are untested. |

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
| `get_order_history` | List past orders |

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

The server has three layers:

- `src/vilgain-api.ts` – HTTP client for the reverse engineered website endpoints (see [docs/api.md](docs/api.md))
- `src/parsers/` – pure functions that extract data from Vilgain HTML pages, unit-tested against fixtures
- `src/tools/` – thin MCP tool wrappers around the API client

## License

MIT
