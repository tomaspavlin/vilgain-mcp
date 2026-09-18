# Reverse engineered Vilgain API

Vilgain has no public JSON API. The website is a server-rendered [Nette](https://nette.org) application; its frontend performs actions through Nette component signals (the `_do` form/query parameter) via [Naja](https://naja.js.org) AJAX requests. This document maps the endpoints this project uses.

## Conventions

- **Session**: cookie-based, `SHOPSESSID` is the session cookie.
- **AJAX requests** send `X-Requested-With: XMLHttpRequest`; the server then responds with JSON (`{"redirect": ...}` or `{"snippets": {...}}` with HTML fragments) instead of a full page.
- The site's own frontend also sends `x-vilgain-waf-bypass: naja-shop`. The site sits behind AWS WAF; a challenged request returns HTTP 202 with a JavaScript challenge.
- Form submissions are `multipart/form-data`, mirroring the browser.
- Signals (`_do=...`) are global: they can be POSTed to any page URL.

## Endpoints

### Login

```
GET  /prihlaseni                  # establishes session cookies
POST /prihlaseni                  # AJAX, multipart form
     email=..., password=..., _do=modalStack-loginModal-form-submit, ok=Přihlásit
```

Response JSON: `{"redirect": "https://vilgain.cz/"}` on success. A redirect back to `/prihlaseni` means invalid credentials.

### Product search

```
GET /vyhledavani?s=<query>        # plain HTML page
```

Parse `.c-product-box` cards: `data-item-id` (product group id), `data-item-name`, `a.c-product-box__link` (product URL), `.c-product-box__price--main`, `.c-product-box__param` (displayed variant), `.c-product-box__rating .sr-only` (rating).

### Product detail

```
GET /<product-slug>                       # default variant
GET /<product-slug>/<variant-slug>-<id>   # specific variant
```

Machine-readable data on the page:

- **JSON-LD** (`script[type="application/ld+json"]`, `@type: Product`): name, description, per-variant offers with URL, price and GTIN. Variant id is the numeric suffix of the variant URL.
- **dataLayer** (inline `([...]).forEach(function (data) { dataLayer.push(data); })`): object with `pageType: "product"` contains a `productVariants` map (id, variant name, priceVat, availability); the `view_item` event carries the `item_id` of the variant the page content refers to.
- **Content tabs**: `#popis` (description), `#slozeni` (ingredients + nutrition `<table>`s), `#davkovani` (dosage). Tabs contain one block per variant, wrapped in `div[data-toggle="content-<uuid>"]`. Which block belongs to which variant is encoded in `data-nette-rules` toggle maps: a map containing `"content-<variantId>": true` lists the `content-<uuid>` keys of that variant's blocks.

### Cart

```
GET  /objednavka                  # cart page
POST /  (any URL)                 # add one piece of a variant, AJAX
     _do=buyVariant-<variantId>-addForm-submit, add=add_to_cart_button
POST /objednavka                  # set absolute quantity, AJAX
     _do=mainBox-productVariant_<variantId>-quantityForm-submit, quantity=<n>
POST /objednavka                  # remove item, AJAX
     _do=mainBox-productVariant_<variantId>-removeForm-submit, remove=
```

Cart content is parsed from the cart page's dataLayer: the object with `total_value_with_vat` contains `items` (`item_id` = variant id, `item_name`, `quantity`, `price`, `variant`).

### Order history

```
GET /muj-ucet/objednavky          # requires login
```

Empty state contains the text "Zatím nemáte žádné objednávky". Order rows link to `/muj-ucet/objednavky/<id>`.

> Note: order row parsing is best-effort — it was developed against an account with no orders yet.
