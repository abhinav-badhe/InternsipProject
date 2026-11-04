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

export interface CustomerSavedAddress {
  id?: string;
  customerId?: string;
  label: 'HOME' | 'WORK' | 'OTHER';
  recipientName: string;
  phone: string;
  flatNumber?: string;
  street: string;
  landmark?: string;
  city: string;
  pincode: string;
  isDefault?: boolean;
  lat?: number;
  lng?: number;
}

export async function fetchCustomerAddresses(): Promise<CustomerSavedAddress[]> {
  try {
    const session = getStoredCustomerSession();
    const token = session?.token;
    const phone = session?.user?.phone || '';
    const userId = session?.user?.userId || '';

    const params = new URLSearchParams();
    if (phone) params.set('phone', phone);
    if (userId) params.set('customerId', userId);

    const queryStr = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`/api/v1/auth/customer/addresses${queryStr}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const json = await res.json();
    if (json.success && Array.isArray(json.data) && json.data.length > 0) {
      localStorage.setItem('freshcart_saved_addresses', JSON.stringify(json.data));
      return json.data;
    }
  } catch (e) {
    // Fallback to localStorage
  }

  const local = localStorage.getItem('freshcart_saved_addresses');
  if (local) {
    try {
      return JSON.parse(local);
    } catch {}
  }

  // Default address
  return [
    {
      id: 'addr_default_home',
      label: 'HOME',
      recipientName: 'Valued Customer',
      phone: '+917745860406',
      flatNumber: 'Flat 402, Lotus Residency',
      street: '12th Main Road, HSR Sector 2',
      landmark: 'Near Green Park Metro',
      city: 'Bengaluru',
      pincode: '560102',
      isDefault: true,
    },
  ];
}

export async function saveCustomerAddress(address: CustomerSavedAddress): Promise<CustomerSavedAddress> {
  const session = getStoredCustomerSession();
  const token = session?.token;
  const userPhone = address.phone || session?.user?.phone || '+917745860406';
  const customerId = address.customerId || session?.user?.userId || `cust_${userPhone.replace(/[^0-9]/g, '').slice(-10)}`;

  const payload = {
    ...address,
    customerId,
    phone: userPhone,
  };

  let saved = address;
  try {
    const res = await fetch('/api/v1/auth/customer/addresses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (json.success && json.data) {
      saved = json.data;
    }
  } catch (e) {
    // Save locally
  }

  // Update localStorage
  const existing = await fetchCustomerAddresses();
  const updated = [saved, ...existing.filter((a) => a.id !== saved.id)];
  localStorage.setItem('freshcart_saved_addresses', JSON.stringify(updated));

  return saved;
}

export async function deleteCustomerAddress(id: string): Promise<void> {
  try {
    const session = getStoredCustomerSession();
    const token = session?.token;
    await fetch(`/api/v1/auth/customer/addresses/${id}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch (e) {}

  const existing = await fetchCustomerAddresses();
  const updated = existing.filter((a) => a.id !== id);
  localStorage.setItem('freshcart_saved_addresses', JSON.stringify(updated));
}

export async function setDefaultCustomerAddress(id: string): Promise<void> {
  try {
    const session = getStoredCustomerSession();
    const token = session?.token;
    await fetch(`/api/v1/auth/customer/addresses/${id}/default`, {
      method: 'PUT',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch (e) {}

  await fetchCustomerAddresses();
}

export async function executeRealCheckout(params: {
  items: Array<{ sku: string; quantity: number }>;
  deliverySlot: string;
  couponCode?: string;
  deliveryAddress?: CustomerSavedAddress;
}): Promise<any> {
  const session = await getCustomerSession();
  const idempotencyKey = `idemp_web_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  const addr = params.deliveryAddress || {
    label: 'HOME' as const,
    recipientName: session.user.fullName || 'Valued Customer',
    phone: session.user.phone || '+917745860406',
    flatNumber: 'Flat 402',
    street: '12th Main Road, HSR Sector 2',
    city: 'Bengaluru',
    pincode: '560102',
  };

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
        recipientName: addr.recipientName,
        phone: addr.phone,
        street: `${addr.flatNumber ? `${addr.flatNumber}, ` : ''}${addr.street}${addr.landmark ? ` (Near ${addr.landmark})` : ''}`,
        addressLine1: `${addr.flatNumber ? `${addr.flatNumber}, ` : ''}${addr.street}`,
        city: addr.city,
        pincode: addr.pincode,
        label: addr.label,
        slot: params.deliverySlot,
        lat: addr.lat != null ? Number(addr.lat) : (addr.label === 'WORK' ? 12.927923 : 12.914142),
        lng: addr.lng != null ? Number(addr.lng) : (addr.label === 'WORK' ? 77.683058 : 77.641151),
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

export interface DeliverySlotOption {
  id: string;
  type: 'EXPRESS' | 'SCHEDULED';
  title: string;
  timeWindow: string;
  tag: string;
  badgeColor: string;
  fee: number;
  available: boolean;
  capacityStatus: string;
  description: string;
}

export async function fetchDeliverySlots(): Promise<DeliverySlotOption[]> {
  try {
    const res = await fetch('/api/v1/orders/delivery-slots');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.success && json.data?.slots) {
      return json.data.slots;
    }
  } catch (err) {
    console.warn('Failed to fetch delivery slots, using fallbacks', err);
  }
  return [
    {
      id: 'express-15',
      type: 'EXPRESS',
      title: 'Express Rush',
      timeWindow: '10 - 15 Mins',
      tag: '⚡ 15-Min Delivery',
      badgeColor: 'amber',
      fee: 25,
      available: true,
      capacityStatus: 'HIGH_DEMAND',
      description: 'Direct priority dispatch',
    },
    {
      id: 'express-30',
      type: 'EXPRESS',
      title: 'Standard Express',
      timeWindow: '25 - 30 Mins',
      tag: 'Free over ₹199',
      badgeColor: 'emerald',
      fee: 0,
      available: true,
      capacityStatus: 'OPTIMAL',
      description: 'Fast eco-batched dispatch',
    },
    {
      id: 'slot-today-evening',
      type: 'SCHEDULED',
      title: 'Today Evening',
      timeWindow: '04:00 PM - 07:00 PM',
      tag: 'Scheduled',
      badgeColor: 'blue',
      fee: 0,
      available: true,
      capacityStatus: 'AVAILABLE',
      description: 'Reserved evening delivery slot',
    },
    {
      id: 'slot-tomorrow-morning',
      type: 'SCHEDULED',
      title: 'Tomorrow Morning',
      timeWindow: '07:00 AM - 10:00 AM',
      tag: 'Breakfast Fresh',
      badgeColor: 'teal',
      fee: 0,
      available: true,
      capacityStatus: 'AVAILABLE',
      description: 'Fresh milk, bakery & farm produce',
    },
  ];
}

export interface WalletTransaction {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  referenceId?: string;
  description: string;
  createdAt: string;
}

export interface CustomerWalletData {
  walletId: string;
  customerId: string;
  balance: number;
  currency: string;
  isActive: boolean;
  transactions: WalletTransaction[];
}

export async function fetchCustomerWallet(): Promise<CustomerWalletData> {
  try {
    const session = await getCustomerSession();
    const res = await fetch('/api/v1/payments/wallet', {
      headers: {
        Authorization: `Bearer ${session.token}`,
        'x-user-id': session.user.userId,
      },
    });
    const json = await res.json();
    if (json.success && json.data) {
      return json.data;
    }
  } catch (err) {
    console.warn('Using local fallback wallet state', err);
  }

  // Offline balances must never imply spendable funds.
  return {
    walletId: '',
    customerId: getStoredCustomerSession()?.user.userId || '',
    balance: 0,
    currency: 'INR',
    isActive: false,
    transactions: [],
  };
}

export async function topupCustomerWallet(amount: number): Promise<CustomerWalletData> {
  const session = await getCustomerSession();
  const res = await fetch('/api/v1/payments/wallet/topup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.token}`,
      'x-user-id': session.user.userId,
    },
    body: JSON.stringify({ amount }),
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || 'Failed to add funds to wallet');
  }
  return fetchCustomerWallet();
}

export async function payOrderWithWallet(orderId: string, amount: number): Promise<any> {
  const session = await getCustomerSession();
  const res = await fetch('/api/v1/payments/wallet/pay', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.token}`,
      'x-user-id': session.user.userId,
    },
    body: JSON.stringify({ orderId, amount }),
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || 'Wallet payment failed');
  }
  return json.data;
}

export interface CouponItem {
  code: string;
  description: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING';
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount?: number;
}

export async function fetchAvailableCoupons(): Promise<CouponItem[]> {
  try {
    const res = await fetch('/api/v1/pricing/coupons');
    const json = await res.json();
    if (json.success && json.data) {
      return json.data;
    }
  } catch (err) {
    console.warn('Failed to fetch live coupons, using offline cache', err);
  }
  return [
    {
      code: 'WELCOME50',
      description: 'Flat ₹50 OFF on your first grocery basket (Min order ₹199)',
      discountType: 'FIXED_AMOUNT',
      discountValue: 50.0,
      minOrderAmount: 199.0,
    },
    {
      code: 'SAVE10',
      description: '10% OFF on all fresh fruits, veggies & staples (Min order ₹300)',
      discountType: 'PERCENTAGE',
      discountValue: 10.0,
      minOrderAmount: 300.0,
      maxDiscountAmount: 100.0,
    },
    {
      code: 'FREESHIP',
      description: 'Free Express Home Delivery on orders above ₹149',
      discountType: 'FREE_SHIPPING',
      discountValue: 40.0,
      minOrderAmount: 149.0,
    },
    {
      code: 'FLAT100',
      description: 'Flat ₹100 instant discount on mega restock (Min order ₹699)',
      discountType: 'FIXED_AMOUNT',
      discountValue: 100.0,
      minOrderAmount: 699.0,
    },
  ];
}

export async function validateCoupon(code: string, subtotal: number): Promise<{
  valid: boolean;
  code: string;
  discountAmount: number;
  description: string;
  savingsMessage: string;
}> {
  const res = await fetch('/api/v1/pricing/coupons/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, subtotal }),
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || 'Invalid coupon code');
  }
  return json.data;
}

export interface ReferralDetails {
  customerId: string;
  referralCode: string;
  shareUrl: string;
  rewardPerFriend: number;
  friendsInvited: number;
  totalEarned: number;
  shareMessage: string;
}

export async function fetchMyReferralCode(): Promise<ReferralDetails> {
  const session = await getCustomerSession();
  const res = await fetch('/api/v1/pricing/referrals/my-code', {
    headers: {
      Authorization: `Bearer ${session.token}`,
      'x-user-id': session.user.userId,
    },
  });
  const json = await res.json();
  if (json.success && json.data) {
    return json.data;
  }
  return {
    customerId: session.user.userId,
    referralCode: `FC${session.user.userId.slice(-4).toUpperCase() || 'GIFT'}`,
    shareUrl: `http://localhost:5173/?ref=FCGIFT`,
    rewardPerFriend: 100.0,
    friendsInvited: 0,
    totalEarned: 0,
    shareMessage: 'Get ₹100 instant bonus on FreshCart groceries!',
  };
}

export async function claimReferralCode(referralCode: string): Promise<any> {
  const session = await getCustomerSession();
  const res = await fetch('/api/v1/pricing/referrals/claim', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.token}`,
      'x-user-id': session.user.userId,
    },
    body: JSON.stringify({ referralCode }),
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || 'Failed to claim referral code');
  }
  return json.data;
}

export interface CustomerSubscription {
  id: string;
  subscription_number: string;
  customer_id: string;
  sku: string;
  product_name: string;
  variant_name: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  frequency: 'DAILY' | 'ALTERNATE_DAYS' | 'WEEKDAYS_ONLY' | 'WEEKLY';
  delivery_slot: string;
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED';
  start_date: string;
  next_delivery_date: string;
  delivery_address: any;
  created_at: string;
}

export async function fetchCustomerSubscriptions(): Promise<CustomerSubscription[]> {
  try {
    const session = await getCustomerSession();
    const res = await fetch('/api/v1/orders/subscriptions', {
      headers: {
        Authorization: `Bearer ${session.token}`,
        'x-user-id': session.user.userId,
      },
    });
    const json = await res.json();
    if (json.success && json.data) {
      return json.data;
    }
  } catch (err) {
    console.warn('Failed to fetch subscriptions', err);
  }
  return [];
}

export async function createSubscription(params: {
  sku: string;
  productName: string;
  variantName?: string;
  quantity: number;
  unitPrice: number;
  frequency: string;
  deliverySlot?: string;
  deliveryAddress?: any;
}): Promise<CustomerSubscription> {
  const session = await getCustomerSession();
  const res = await fetch('/api/v1/orders/subscriptions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.token}`,
      'x-user-id': session.user.userId,
    },
    body: JSON.stringify(params),
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || 'Failed to create subscription');
  }
  return json.data;
}

export async function pauseSubscription(id: string): Promise<void> {
  const session = await getCustomerSession();
  await fetch(`/api/v1/orders/subscriptions/${id}/pause`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.token}`,
      'x-user-id': session.user.userId,
    },
  });
}

export async function resumeSubscription(id: string): Promise<void> {
  const session = await getCustomerSession();
  await fetch(`/api/v1/orders/subscriptions/${id}/resume`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.token}`,
      'x-user-id': session.user.userId,
    },
  });
}

export async function cancelSubscription(id: string): Promise<void> {
  const session = await getCustomerSession();
  await fetch(`/api/v1/orders/subscriptions/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${session.token}`,
      'x-user-id': session.user.userId,
    },
  });
}

export async function triggerDailySubscriptionBatch(): Promise<any> {
  const res = await fetch('/api/v1/orders/subscriptions/process-daily', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error?.message || 'Subscription batch execution failed');
  return data.data;
}

// ====================================================================
// Feature 21: Real Payment Gateway (Razorpay / UPI QR / PhonePe)
// ====================================================================

export interface GatewayOrderDetails {
  success: boolean;
  provider: string;
  keyId: string;
  razorpayOrderId: string;
  amountInPaise: number;
  amount: number;
  currency: string;
  customerName: string;
  customerPhone: string;
  upiString: string;
  upiQrUrl: string;
  paymentAttemptId: string;
}

export async function initiateGatewayOrder(
  orderId: string,
  amount: number
): Promise<GatewayOrderDetails> {
  const session = await getCustomerSession();
  const res = await fetch('/api/v1/payments/gateway/order', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.token}`,
      'x-user-id': session.user.userId,
    },
    body: JSON.stringify({
      orderId,
      amount,
      customerId: session.user.userId,
      customerName: session.user.fullName,
      customerPhone: session.user.phone || '+91 98765 43210',
    }),
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || 'Failed to initialize payment gateway order');
  }
  return json.data;
}

export async function verifyGatewayPayment(params: {
  orderId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature?: string;
}): Promise<{ success: boolean; message: string; paymentId: string }> {
  const session = await getCustomerSession();
  const res = await fetch('/api/v1/payments/gateway/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.token}`,
      'x-user-id': session.user.userId,
    },
    body: JSON.stringify(params),
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || 'Payment verification failed');
  }
  return json.data;
}

// ====================================================================
// Feature 22: Split Payments (Wallet + UPI / Gateway)
// ====================================================================

export interface SplitPaymentInitiateResult {
  success: boolean;
  splitId: string;
  orderId: string;
  totalAmount: number;
  walletAmount: number;
  gatewayAmount: number;
  status: string;
  walletTransactionId?: string;
  gateway?: {
    provider: string;
    keyId: string;
    gatewayOrderId: string;
    amountInPaise: number;
    upiString: string;
    upiQrUrl: string;
  };
}

export async function initiateSplitPayment(params: {
  orderId: string;
  totalAmount: number;
  walletAmount: number;
  gatewayAmount: number;
}): Promise<SplitPaymentInitiateResult> {
  const session = await getCustomerSession();
  const res = await fetch('/api/v1/payments/split/initiate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.token}`,
      'x-user-id': session.user.userId,
    },
    body: JSON.stringify({
      ...params,
      customerId: session.user.userId,
    }),
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || 'Failed to initiate split payment');
  }
  return json.data;
}

export async function confirmSplitPayment(params: {
  splitId: string;
  gatewayPaymentId: string;
  gatewaySignature?: string;
}): Promise<any> {
  const session = await getCustomerSession();
  const res = await fetch('/api/v1/payments/split/confirm', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.token}`,
      'x-user-id': session.user.userId,
    },
    body: JSON.stringify(params),
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || 'Failed to confirm split payment');
  }
  return json.data;
}

// ====================================================================
// Feature 18: Dynamic / Surge Pricing Engine
// ====================================================================

export interface SurgePricingStatus {
  isSurgeActive: boolean;
  totalSurgeFee: number;
  multiplier: number;
  reasons: string[];
  activeRules: Array<{
    code: string;
    name: string;
    surgeType: string;
    feeAmount: number;
    multiplier: number;
    description: string;
  }>;
}

export async function fetchSurgePricingStatus(): Promise<SurgePricingStatus> {
  try {
    const res = await fetch('/api/v1/pricing/surge/status');
    const json = await res.json();
    if (json.success && json.data) {
      return json.data;
    }
  } catch {}
  return {
    isSurgeActive: false,
    totalSurgeFee: 0,
    multiplier: 1.0,
    reasons: [],
    activeRules: [],
  };
}

export async function toggleSurgeRule(code: string, isActive: boolean): Promise<void> {
  await fetch('/api/v1/pricing/surge/toggle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, isActive }),
  });
}

// ====================================================================
// Feature 19: AI-Powered Product Recommendations
// ====================================================================

export interface ProductRecommendation {
  product: Product;
  recommendedVariant: ProductVariant;
  affinityReason: string;
  affinityScore: number;
}

export async function fetchProductRecommendations(
  cartSkus: string[]
): Promise<ProductRecommendation[]> {
  try {
    const skuParam = cartSkus.filter(Boolean).join(',');
    const url = `/api/v1/catalog/recommendations${skuParam ? `?cartSkus=${encodeURIComponent(skuParam)}` : ''}`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.success && json.data?.recommendations) {
      return json.data.recommendations;
    }
  } catch {}
  return [];
}

// ====================================================================
// Feature 14: Product Reviews, Star Ratings & Recipe Bundles
// ====================================================================

export interface RecipeIngredient {
  id: string;
  sku: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalItemPrice: number;
  imageUrl: string;
}

export interface RecipeBundle {
  id: string;
  name: string;
  slug: string;
  cuisine: string;
  description: string;
  prepTimeMinutes: number;
  servings: number;
  imageUrl: string;
  bundleDiscountPercent: number;
  originalPrice: number;
  savings: number;
  bundlePrice: number;
  ingredients: RecipeIngredient[];
}

export async function fetchRecipeBundles(): Promise<RecipeBundle[]> {
  try {
    const res = await fetch('/api/v1/catalog/recipes');
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      return json.data;
    }
  } catch {}
  return [];
}

export interface ProductReviewItem {
  id: string;
  productId: string;
  customerId: string;
  customerName: string;
  rating: number;
  reviewText: string;
  isVerifiedBuyer: boolean;
  createdAt: string;
}

export async function fetchProductReviews(
  productId: string
): Promise<{ averageRating: number; totalReviews: number; reviews: ProductReviewItem[] }> {
  try {
    const res = await fetch(`/api/v1/catalog/products/${productId}/reviews`);
    const json = await res.json();
    if (json.success && json.data) {
      return json.data;
    }
  } catch {}
  return { averageRating: 4.8, totalReviews: 12, reviews: [] };
}

export async function submitProductReview(
  productId: string,
  rating: number,
  reviewText: string
): Promise<ProductReviewItem> {
  const session = await getCustomerSession();
  const res = await fetch(`/api/v1/catalog/products/${productId}/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.token}`,
      'x-user-id': session.user.userId,
    },
    body: JSON.stringify({
      rating,
      reviewText,
      customerName: session.user.fullName,
    }),
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || 'Failed to submit review');
  }
  return json.data;
}
