import { CartContent, OrderDetail, OrderSummary, ProductDetail, SearchProduct, VilgainCredentials } from './types.js';
import { parseCart } from './parsers/cart.js';
import { isOrderHistoryEmpty, parseOrderDetail, parseOrderHistory } from './parsers/orders.js';
import { parseProductDetail } from './parsers/product.js';
import { parseSearchResults } from './parsers/search.js';

export class VilgainAPIError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'VilgainAPIError';
  }
}

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

interface RequestOptions {
  method?: 'GET' | 'POST';
  /** Form fields sent as multipart/form-data (mirrors the site's own forms). */
  form?: Record<string, string>;
  /** Send Naja AJAX headers; the server then responds with JSON instead of a redirect. */
  ajax?: boolean;
}

/**
 * Client for the reverse engineered Vilgain.cz web endpoints.
 *
 * Vilgain has no public JSON API; the website is a server-rendered Nette
 * application. This client talks to the same endpoints the website's own
 * frontend uses (Nette "signals" via the `_do` form field) and parses data
 * out of the returned HTML/JSON. See docs/api.md for the endpoint map.
 */
export class VilgainAPI {
  private cookies = new Map<string, string>();
  private loggedIn = false;
  private lastRequestTime = 0;
  private readonly minRequestInterval = 100;

  constructor(
    private credentials: VilgainCredentials,
    readonly baseUrl: string = 'https://vilgain.cz'
  ) {}

  private async rateLimit(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestTime;
    if (elapsed < this.minRequestInterval) {
      await new Promise((resolve) => setTimeout(resolve, this.minRequestInterval - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  private storeCookies(response: Response): void {
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(';');
      const eq = pair.indexOf('=');
      if (eq > 0) {
        this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
      }
    }
  }

  private async request(path: string, options: RequestOptions = {}): Promise<Response> {
    await this.rateLimit();

    const url = new URL(path, this.baseUrl).href;
    const headers: Record<string, string> = {
      'User-Agent': USER_AGENT,
      'Accept-Language': 'cs,en;q=0.8',
      // The site's own AJAX layer sends this header; without it some
      // requests can be challenged by the WAF.
      'x-vilgain-waf-bypass': 'naja-shop',
    };
    if (options.ajax) {
      headers['X-Requested-With'] = 'XMLHttpRequest';
      headers['Accept'] = '*/*';
    }
    if (this.cookies.size > 0) {
      headers['Cookie'] = [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    }

    let body: FormData | undefined;
    if (options.form) {
      body = new FormData();
      for (const [key, value] of Object.entries(options.form)) {
        body.append(key, value);
      }
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method: options.method ?? (options.form ? 'POST' : 'GET'),
        headers,
        body,
      });
    } catch (error) {
      throw new VilgainAPIError(`Request to ${url} failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    this.storeCookies(response);

    if (response.status === 202) {
      throw new VilgainAPIError(
        'Request was challenged by the site\'s bot protection (HTTP 202). Try again later.',
        202
      );
    }
    if (!response.ok) {
      throw new VilgainAPIError(`Request to ${url} failed with HTTP ${response.status}`, response.status);
    }
    return response;
  }

  /** Log in and store the session cookie. Called automatically when needed. */
  async login(): Promise<void> {
    // Initial GET establishes the session cookies the login form expects.
    await this.request('/prihlaseni');

    const response = await this.request('/prihlaseni', {
      ajax: true,
      form: {
        email: this.credentials.email,
        password: this.credentials.password,
        _do: 'modalStack-loginModal-form-submit',
        ok: 'Přihlásit',
      },
    });

    const result = (await response.json()) as { redirect?: string };
    // On success the server redirects away from the login page;
    // on bad credentials it redirects back to it.
    if (!result.redirect || result.redirect.includes('/prihlaseni')) {
      throw new VilgainAPIError('Login failed - check VILGAIN_EMAIL and VILGAIN_PASSWORD');
    }
    this.loggedIn = true;
  }

  private async ensureLoggedIn(): Promise<void> {
    if (!this.loggedIn) {
      await this.login();
    }
  }

  /**
   * Fetch a page that requires authentication. If the session has expired
   * (the server redirects to the login page), re-login and retry once.
   */
  private async getAuthenticatedPage(path: string): Promise<string> {
    await this.ensureLoggedIn();
    let response = await this.request(path);
    if (new URL(response.url).pathname === '/prihlaseni') {
      this.loggedIn = false;
      await this.ensureLoggedIn();
      response = await this.request(path);
    }
    return response.text();
  }

  /** Full-text product search. */
  async searchProducts(query: string, limit = 10): Promise<SearchProduct[]> {
    const response = await this.request(`/vyhledavani?s=${encodeURIComponent(query)}`);
    const html = await response.text();
    return parseSearchResults(html, this.baseUrl).slice(0, limit);
  }

  /**
   * Fetch and parse a product detail page. Accepts absolute or relative product URLs.
   * With `variantId`, the page of that specific variant is fetched instead of the
   * default one (the router resolves `/<product-slug>/<anything>-<variantId>`).
   */
  async getProductDetail(productUrl: string, variantId?: number): Promise<ProductDetail> {
    let url = new URL(productUrl, this.baseUrl);
    if (url.host !== new URL(this.baseUrl).host) {
      throw new VilgainAPIError(`Product URL must be on ${this.baseUrl}`);
    }
    if (variantId !== undefined) {
      const productSlug = url.pathname.split('/').filter(Boolean)[0];
      if (!productSlug) {
        throw new VilgainAPIError('Product URL is missing the product slug');
      }
      url = new URL(`/${productSlug}/v-${variantId}`, this.baseUrl);
    }
    const response = await this.request(url.href);
    const html = await response.text();
    const detail = parseProductDetail(html, response.url);
    if (variantId !== undefined && detail.selectedVariantId !== variantId) {
      throw new VilgainAPIError(`Variant ${variantId} not found on ${productUrl}`);
    }
    return detail;
  }

  /** Get current cart content. */
  async getCart(): Promise<CartContent> {
    const html = await this.getAuthenticatedPage('/objednavka');
    return parseCart(html);
  }

  /**
   * Add a product variant to the cart. Each call adds `quantity` more pieces
   * (the shop's add-to-cart adds one; larger quantities are set explicitly
   * afterwards). Returns the updated cart.
   */
  async addToCart(variantId: number, quantity = 1): Promise<CartContent> {
    await this.ensureLoggedIn();
    await this.request('/', {
      ajax: true,
      form: {
        _do: `buyVariant-${variantId}-addForm-submit`,
        add: 'add_to_cart_button',
      },
    });

    let cart = await this.getCart();
    const item = cart.items.find((i) => i.variantId === variantId);
    if (!item) {
      throw new VilgainAPIError(
        `Adding variant ${variantId} to the cart had no effect - the variant id is probably invalid or out of stock`
      );
    }
    if (quantity > 1) {
      cart = await this.setCartItemQuantity(variantId, item.quantity + quantity - 1);
    }
    return cart;
  }

  /** Set the absolute quantity of a cart item. Returns the updated cart. */
  async setCartItemQuantity(variantId: number, quantity: number): Promise<CartContent> {
    await this.ensureLoggedIn();
    await this.request('/objednavka', {
      ajax: true,
      form: {
        _do: `mainBox-productVariant_${variantId}-quantityForm-submit`,
        quantity: String(quantity),
      },
    });
    return this.getCart();
  }

  /** Remove an item from the cart. Returns the updated cart. */
  async removeFromCart(variantId: number): Promise<CartContent> {
    await this.ensureLoggedIn();
    await this.request('/objednavka', {
      ajax: true,
      form: {
        _do: `mainBox-productVariant_${variantId}-removeForm-submit`,
        remove: '',
      },
    });
    return this.getCart();
  }

  /** List past orders (most recent first, as displayed by the shop). */
  async getOrderHistory(): Promise<{ orders: OrderSummary[]; empty: boolean }> {
    const html = await this.getAuthenticatedPage('/muj-ucet/objednavky');
    return {
      orders: parseOrderHistory(html, this.baseUrl),
      empty: isOrderHistoryEmpty(html),
    };
  }

  /** Get one order's items, total, delivery destination and shipment timeline. */
  async getOrderDetail(orderId: string): Promise<OrderDetail> {
    if (!/^\d+$/.test(orderId)) {
      throw new VilgainAPIError(`Invalid order id "${orderId}" - expected a number from get_order_history`);
    }
    const html = await this.getAuthenticatedPage(`/muj-ucet/objednavka/${orderId}`);
    const detail = parseOrderDetail(html, this.baseUrl);
    if (!detail.orderNumber) {
      throw new VilgainAPIError(`Order ${orderId} not found on this account`);
    }
    return detail;
  }
}
