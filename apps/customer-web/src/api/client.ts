import { Product, ProductVariant, Category } from '../data/catalog';
import { CustomerOrder } from '../components/OrderHistoryModal';

export interface AuthSession {
  token: string;
  user: {
    userId: string;
    fullName: string;
    email?: string;
    phone?: string;
    role: string;
  };
}

export interface LoginResponse {
  mfaRequired: boolean;
  mfaTicket?: string;
  destination?: string;
  demoOtp?: string;
  user?: AuthSession['user'];
  token?: string;
}

let cachedSession: AuthSession | null = null;

export function getStoredCustomerSession(): AuthSession | null {
  if (cachedSession) return cachedSession;
  const stored = localStorage.getItem('grocery_customer_session');
  if (stored) {
    try {
      cachedSession = JSON.parse(stored);
      return cachedSession;
    } catch {}
  }
  return null;
}

export async function signInCustomer(identifier: string, password: string): Promise<LoginResponse> {
  const res = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || 'Invalid email or password');
  }

  const data: LoginResponse = json.data;
  if (!data.mfaRequired && data.token && data.user) {
    cachedSession = { token: data.token, user: data.user };
    localStorage.setItem('grocery_customer_session', JSON.stringify(cachedSession));
  }
  return data;
}

export async function verifyCustomerMfa(ticket: string, otp: string): Promise<AuthSession> {
  const res = await fetch('/api/v1/auth/mfa/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticket, otp }),
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || 'Invalid or expired MFA code');
  }

  cachedSession = json.data;
  localStorage.setItem('grocery_customer_session', JSON.stringify(cachedSession));
  return cachedSession!;
}

export async function registerCustomer(params: {
  fullName: string;
  email?: string;
  phone?: string;
  password: string;
  enableMfa?: boolean;
}): Promise<AuthSession> {
  const res = await fetch('/api/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...params, role: 'CUSTOMER' }),
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || 'Registration failed');
  }

  cachedSession = json.data;
  localStorage.setItem('grocery_customer_session', JSON.stringify(cachedSession));
  return cachedSession!;
}

export async function sendCustomerPhoneOtp(params: {
  phone: string;
  email?: string;
  fullName?: string;
}): Promise<{ ticket: string; destination: string; demoOtp: string }> {
  const res = await fetch('/api/v1/auth/customer/send-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || 'Failed to send OTP to mobile number');
  }
  return json.data;
}

export async function verifyCustomerPhoneOtp(params: {
  ticket: string;
  otp: string;
}): Promise<AuthSession> {
  const res = await fetch('/api/v1/auth/customer/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || 'Invalid or expired OTP code');
  }

  cachedSession = json.data;
  localStorage.setItem('grocery_customer_session', JSON.stringify(cachedSession));
  return cachedSession!;
}

export function signOutCustomer(): void {
  cachedSession = null;
  localStorage.removeItem('grocery_customer_session');
}

export async function getCustomerSession(): Promise<AuthSession> {
  const existing = getStoredCustomerSession();
  if (existing) return existing;

  // Auto-login or register customer
  try {
    const loginRes = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'customer@example.com',
        password: 'password123',
      }),
    });
    const loginData = await loginRes.json();
    if (loginData.success && loginData.data?.token) {
      cachedSession = { token: loginData.data.token, user: loginData.data.user };
      localStorage.setItem('grocery_customer_session', JSON.stringify(cachedSession));
      return cachedSession!;
    }
  } catch {}

  // If login fails, register
  const regRes = await fetch('/api/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Customer Storefront',
      email: 'customer@example.com',
      password: 'password123',
      role: 'CUSTOMER',
      enableMfa: false,
    }),
  });
  const regData = await regRes.json();
  if (regData.success && regData.data?.token) {
    cachedSession = { token: regData.data.token, user: regData.data.user };
    localStorage.setItem('grocery_customer_session', JSON.stringify(cachedSession));
    return cachedSession!;
  }

  throw new Error('Could not establish customer authentication session');
}

export async function fetchLiveCategories(): Promise<Category[]> {
  try {
    const res = await fetch('/api/v1/catalog/categories');
    const json = await res.json();
    if (!json.success || !Array.isArray(json.data)) return [];

    const iconMap: Record<string, string> = {
      'fruits-vegetables': 'Apple',
      'dairy-bread-eggs': 'Milk',
      'staples-flours-rice': 'Wheat',
      'masalas-spices-dryfruits': 'Flame',
      'snacks-biscuits': 'Cookie',
      'beverages-drinks': 'Coffee',
      'instant-frozen-foods': 'Package',
      'chocolates-sweets-desserts': 'Heart',
      'personal-care-hygiene': 'Sparkles',
      'cleaning-household': 'Shirt',
      'baby-pet-care': 'Smile',
      'bathing-soaps': 'Sparkles',
      'washing-soaps': 'Shirt',
      'utensil-soaps': 'Utensils',
      'dairy-butter-eggs': 'Milk',
      'breads-bakery': 'Wheat',
      'spices-masalas': 'Flame',
      'atta-flours': 'Wheat',
      'oral-care': 'Smile',
      'hair-care': 'Scissors',
      'tea-coffee': 'Coffee',
    };

    const allPill: Category = {
      id: 'ALL',
      name: 'All Products',
      shortLabel: 'All',
      slug: 'all',
      iconName: 'LayoutGrid',
    };

    const dbCats = json.data.map((c: any) => ({
      id: c.id,
      name: c.name,
      shortLabel: c.name.split('&')[0].trim(),
      slug: c.slug,
      iconName: iconMap[c.slug] || 'LayoutGrid',
    }));

    return [allPill, ...dbCats];
  } catch (err) {
    console.error('Failed to fetch live categories:', err);
    return [];
  }
}

export async function fetchLiveProducts(): Promise<Product[]> {
  const res = await fetch('/api/v1/catalog/products?limit=5000');
  const json = await res.json();
  const rawList = json.data?.items || json.data?.products || [];
  if (!json.success || rawList.length === 0) return [];

  // Default fallback lookups only if backend has 0/null
  const samplePricing: Record<string, { price: number; mrp: number; stock: number }> = {
    'DOVE-BAR-75G': { price: 52, mrp: 55, stock: 98 },
    'DOVE-BAR-125G-4PK': { price: 260, mrp: 290, stock: 1 },
    'RIN-BAR-250G': { price: 20, mrp: 22, stock: 80 },
    'RIN-BAR-500G-2PK': { price: 40, mrp: 45, stock: 40 },
    'VIM-BAR-150G': { price: 14, mrp: 15, stock: 120 },
    'VIM-BAR-300G-SCRUB': { price: 32, mrp: 35, stock: 60 },
    'AMUL-TZ-500ML': { price: 27, mrp: 28, stock: 50 },
    'AMUL-TZ-1L': { price: 54, mrp: 56, stock: 30 },
    'PROD-ONION-1KG': { price: 38, mrp: 45, stock: 200 },
    'PROD-ONION-5KG': { price: 180, mrp: 210, stock: 50 },
  };

  return rawList.map((p: any) => {
    const rawVariants = Array.isArray(p.variants) && p.variants.length > 0
      ? p.variants
      : [
          {
            sku: `SKU-${p.id.slice(0, 8)}`,
            variantName: 'Standard',
            price: 50,
            stock: 20,
            imageUrls: [],
          },
        ];

    const variants: ProductVariant[] = rawVariants.map((v: any) => {
      const fallback = samplePricing[v.sku] || { price: 40, mrp: 45, stock: 25 };
      const rawPrice = Number(v.price);
      const price = !isNaN(rawPrice) && rawPrice > 0 ? rawPrice : fallback.price;
      const rawMrp = Number(v.mrp);
      const mrp = !isNaN(rawMrp) && rawMrp >= price ? rawMrp : Math.round(price * 1.15);
      const stock = typeof v.stock === 'number' ? v.stock : fallback.stock;

      return {
        sku: v.sku,
        name: v.variantName || `${p.name} - ${v.sku}`,
        packSize: v.variantName || 'Standard Pack',
        price,
        mrp,
        availableStock: stock,
        imageUrl:
          (v.imageUrls && v.imageUrls[0]) ||
          'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=500&auto=format&fit=crop&q=80',
      };
    });

    const categoryId = p.category?.id || p.primaryCategoryId || 'ALL';
    const categoryName = p.category?.name || 'General Groceries';

    return {
      id: p.id,
      name: p.name,
      brand: p.brand?.name || 'FreshCart',
      categoryId,
      categoryName,
      description: p.description || '',
      rating: Number((4.5 + ((p.name.charCodeAt(0) % 5) / 10)).toFixed(1)),
      reviewCount: 50 + (p.name.charCodeAt(1) % 250),
      variants,
    };
  });
}

export async function fetchLiveCustomerOrders(): Promise<CustomerOrder[]> {
  try {
    const session = await getCustomerSession();
    const res = await fetch('/api/v1/orders', {
      headers: {
        Authorization: `Bearer ${session.token}`,
      },
    });
    const json = await res.json();
    if (!json.success || !Array.isArray(json.data)) return [];

    return json.data.map((o: any) => ({
      id: o.id,
      orderNumber: o.order_number || o.id,
      createdAt: o.created_at || new Date().toISOString(),
      status: o.status || 'CONFIRMED',
      grandTotal: parseFloat(o.grand_total || '0'),
      channel: o.channel || 'WEB',
      itemsSummary:
        Array.isArray(o.items) && o.items.length > 0
          ? o.items.map((i: any) => `${i.quantity}× ${i.productName || i.product_name}`).join(', ')
          : `Order #${o.order_number || o.id}`,
      invoiceId: `inv-${o.id}`,
    }));
  } catch {
    return [];
  }
}

export async function executeRealCheckout(params: {
  items: Array<{ sku: string; quantity: number }>;
  deliverySlot: string;
  couponCode?: string;
}): Promise<any> {
  const session = await getCustomerSession();
  const idempotencyKey = `idemp_web_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  const res = await fetch('/api/v1/orders/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.token}`,
    },
    body: JSON.stringify({
      idempotencyKey,
      customerId: session.user.userId,
      channel: 'WEB',
      deliveryAddress: {
        street: '12th Main Road, HSR Sector 2',
        city: 'Bengaluru',
        pincode: '560102',
        slot: params.deliverySlot,
      },
      items: params.items,
      promoCode: params.couponCode,
    }),
  });

  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || 'Checkout failed');
  }

  return json.data;
}

export async function disambiguateQuery(term: string): Promise<any> {
  const res = await fetch(`/api/v1/catalog/disambiguate?term=${encodeURIComponent(term)}`);
  const json = await res.json();
  return json.success ? json.data : null;
}
