export interface AdminSession {
  token: string;
  user: {
    userId: string;
    fullName: string;
    email: string;
    role: string;
    phone?: string;
  };
}

export interface AdminLoginResult {
  session?: AdminSession;
  mfaRequired?: boolean;
  mfaTicket?: string;
  destination?: string;
  demoOtp?: string;
}

let cachedAdminSession: AdminSession | null = null;

export function getStoredAdminSession(): AdminSession | null {
  if (cachedAdminSession) return cachedAdminSession;
  const stored = localStorage.getItem('grocery_admin_session');
  if (stored) {
    try {
      cachedAdminSession = JSON.parse(stored);
      return cachedAdminSession;
    } catch {
      localStorage.removeItem('grocery_admin_session');
    }
  }
  return null;
}

export async function signInAdmin(identifier: string, password: string): Promise<AdminLoginResult> {
  const res = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error?.message || 'Login failed. Please check credentials.');
  }

  if (data.data?.mfaRequired) {
    return {
      mfaRequired: true,
      mfaTicket: data.data.mfaTicket,
      destination: data.data.destination,
      demoOtp: data.data.demoOtp,
    };
  }

  if (data.data?.token) {
    cachedAdminSession = data.data;
    localStorage.setItem('grocery_admin_session', JSON.stringify(cachedAdminSession));
    return { session: cachedAdminSession! };
  }

  throw new Error('Unexpected authentication response');
}

export async function verifyAdminMfa(ticket: string, code: string): Promise<AdminSession> {
  const res = await fetch('/api/v1/auth/mfa/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticket, code }),
  });
  const data = await res.json();
  if (!res.ok || !data.success || !data.data?.token) {
    throw new Error(data.error?.message || 'Invalid or expired 2FA OTP code');
  }

  cachedAdminSession = data.data;
  localStorage.setItem('grocery_admin_session', JSON.stringify(cachedAdminSession));
  return cachedAdminSession!;
}

export async function registerAdmin(params: {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
  role?: string;
  enableMfa?: boolean;
}): Promise<AdminSession> {
  const res = await fetch('/api/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: params.fullName,
      email: params.email,
      phone: params.phone,
      password: params.password,
      role: params.role || 'STORE_ADMIN',
      enableMfa: params.enableMfa !== false,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.success || !data.data?.token) {
    throw new Error(data.error?.message || 'Registration failed');
  }

  cachedAdminSession = data.data;
  localStorage.setItem('grocery_admin_session', JSON.stringify(cachedAdminSession));
  return cachedAdminSession!;
}

export function signOutAdmin(): void {
  cachedAdminSession = null;
  authInFlight = null;
  localStorage.removeItem('grocery_admin_session');
}

let authInFlight: Promise<AdminSession> | null = null;

export async function getAdminSession(forceRefresh = false): Promise<AdminSession> {
  if (!forceRefresh && cachedAdminSession) return cachedAdminSession;

  if (!forceRefresh) {
    const stored = getStoredAdminSession();
    if (stored) return stored;
  }

  if (authInFlight) {
    return authInFlight;
  }

  authInFlight = (async () => {
    try {
      // Attempt login with admin credentials
      try {
        const loginResult = await signInAdmin('badheabhi1@gmail.com', 'Shopkeeper@123').catch(() =>
          signInAdmin('admin@grocery.local', 'adminpassword123')
        );
        if (loginResult.session) {
          cachedAdminSession = loginResult.session;
          return cachedAdminSession;
        }
        if (loginResult.mfaRequired && loginResult.mfaTicket && loginResult.demoOtp) {
          const verified = await verifyAdminMfa(loginResult.mfaTicket, loginResult.demoOtp);
          cachedAdminSession = verified;
          return cachedAdminSession;
        }
      } catch {}

      // Fallback to register
      try {
        const regSession = await registerAdmin({
          fullName: 'Store Admin',
          email: 'badheabhi1@gmail.com',
          password: 'Shopkeeper@123',
          role: 'STORE_ADMIN',
          enableMfa: false,
        }).catch(() =>
          registerAdmin({
            fullName: 'Store Admin',
            email: 'admin@grocery.local',
            password: 'adminpassword123',
            role: 'STORE_ADMIN',
            enableMfa: true,
          })
        );
        cachedAdminSession = regSession;
        return cachedAdminSession;
      } catch {}

      throw new Error('Unable to authenticate as Store Admin');
    } finally {
      authInFlight = null;
    }
  })();

  return authInFlight;
}

async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  let session = await getAdminSession();
  let headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
    Authorization: `Bearer ${session.token}`,
  };
  let res = await fetch(url, { ...options, headers });

  // If unauthorized / token expired, refresh token once and retry
  if (res.status === 401) {
    cachedAdminSession = null;
    localStorage.removeItem('grocery_admin_session');
    session = await getAdminSession(true);
    headers = {
      ...((options.headers as Record<string, string>) || {}),
      Authorization: `Bearer ${session.token}`,
    };
    res = await fetch(url, { ...options, headers });
  }

  return res;
}

export async function fetchLiveCatalogProducts(): Promise<any[]> {
  try {
    const res = await fetch('/api/v1/catalog/products?limit=5000');
    const json = await res.json();
    if (json.success && json.data) {
      return Array.isArray(json.data.items) ? json.data.items : Array.isArray(json.data) ? json.data : [];
    }
  } catch (err) {
    console.error('Failed to fetch live catalog products', err);
  }
  return [];
}

export async function fetchLiveCatalogCategories(): Promise<any[]> {
  try {
    const res = await fetch('/api/v1/catalog/categories');
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      return json.data;
    }
  } catch (err) {
    console.error('Failed to fetch live catalog categories', err);
  }
  return [];
}

export async function fetchLivePrices(): Promise<any[]> {
  try {
    const res = await fetch('/api/v1/pricing/prices');
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      return json.data;
    }
  } catch (err) {
    console.error('Failed to fetch live prices', err);
  }
  return [];
}

export async function fetchLiveStockBalances(): Promise<any[]> {
  try {
    const res = await authFetch('/api/v1/inventory/balances');
    const json = await res.json();
    return json.success && Array.isArray(json.data) ? json.data : [];
  } catch (err) {
    console.error('Failed to fetch live balances', err);
    return [];
  }
}

export async function fetchLiveStockMovements(): Promise<any[]> {
  try {
    const res = await authFetch('/api/v1/inventory/movements');
    const json = await res.json();
    return json.success && Array.isArray(json.data) ? json.data : [];
  } catch (err) {
    console.error('Failed to fetch live movements', err);
    return [];
  }
}

export async function fetchLiveAdminOrders(): Promise<any[]> {
  try {
    const res = await authFetch('/api/v1/orders');
    const json = await res.json();
    return json.success && Array.isArray(json.data) ? json.data : [];
  } catch (err) {
    console.error('Failed to fetch live orders', err);
    return [];
  }
}

export async function fetchLiveFulfillmentTasks(): Promise<any[]> {
  try {
    const res = await authFetch('/api/v1/fulfillment/tasks');
    const json = await res.json();
    return json.success && Array.isArray(json.data) ? json.data : [];
  } catch (err) {
    console.error('Failed to fetch live fulfillment tasks', err);
    return [];
  }
}

export async function updateFulfillmentTaskStatus(taskId: string, status: string): Promise<any> {
  const res = await authFetch(`/api/v1/fulfillment/tasks/${taskId}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  const json = await res.json();
  return json.data;
}

export async function scanPickItemBarcode(params: {
  barcode: string;
  orderNumber?: string;
  taskId?: string;
}): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    const res = await authFetch('/api/v1/fulfillment/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return {
        success: false,
        error: json.error?.message || json.message || 'Scanned barcode does not match pending order items',
      };
    }
    return { success: true, data: json.data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error scanning barcode' };
  }
}

export async function fetchOrderPickList(orderNumber: string): Promise<any> {
  try {
    const res = await authFetch(`/api/v1/fulfillment/orders/${orderNumber}/pick-list`);
    const json = await res.json();
    return json.success ? json.data : null;
  } catch (err) {
    console.error('Failed to fetch order pick list', err);
    return null;
  }
}

export async function fetchLiveInvoices(): Promise<any[]> {
  try {
    const res = await authFetch('/api/v1/invoices');
    const json = await res.json();
    return json.success && Array.isArray(json.data) ? json.data : [];
  } catch (err) {
    console.error('Failed to fetch live invoices', err);
    return [];
  }
}

export async function sendInvoiceViaWhatsApp(params: {
  orderNumber: string;
  customerPhone: string;
  customerName?: string;
  invoiceNumber?: string;
  items?: any[];
  subtotal?: number;
  taxTotal?: number;
  deliveryFee?: number;
  grandTotal: number;
  paymentCheckoutUrl?: string;
}): Promise<any> {
  const res = await fetch('/api/v1/whatsapp/send-invoice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || 'Failed to send WhatsApp invoice');
  }
  return json.data;
}

export async function adjustStockInDb(params: {
  sku: string;
  delta: number;
  reason: string;
  locationZone?: string;
}): Promise<any> {
  const res = await authFetch('/api/v1/inventory/adjust', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || 'Stock adjustment failed');
  }
  return json.data;
}

export async function createProductInDb(params: any): Promise<any> {
  const res = await authFetch('/api/v1/catalog/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || 'Product creation failed');
  }
  return json.data;
}

export async function addVariantInDb(productId: string, params: any): Promise<any> {
  const res = await authFetch(`/api/v1/catalog/products/${productId}/variants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || 'Adding variant failed');
  }
  return json.data;
}

export async function trainForecastingModel(): Promise<any> {
  const res = await authFetch('/api/v1/analytics/train-model', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || 'Failed to train ML forecasting model');
  }
  return json.data;
}

export async function generateLiveForecasts(horizonDays = 7): Promise<any> {
  const res = await authFetch('/api/v1/analytics/generate-forecasts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ horizonDays }),
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || 'Failed to generate live forecasts');
  }
  return json.data;
}

export async function fetchStorewideForecasts(horizonDays = 7): Promise<any> {
  const res = await authFetch(`/api/v1/analytics/forecasts?horizonDays=${horizonDays}`);
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || 'Failed to fetch forecasts');
  }
  return json.data;
}

export async function fetchModelInfo(): Promise<any> {
  const res = await authFetch('/api/v1/analytics/model-info');
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || 'Failed to fetch model info');
  }
  return json.data;
}

export async function updateOrderStatusInDb(orderId: string, status: string, reason?: string): Promise<any> {
  const res = await authFetch(`/api/v1/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, reason }),
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || 'Failed to update order status');
  }
  return json.data;
}

export async function cancelOrderInDb(orderId: string, reason?: string): Promise<any> {
  const res = await authFetch(`/api/v1/orders/${orderId}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || 'Failed to cancel order');
  }
  return json.data;
}

// ====================================================================
// FEATURE 11: AUTOMATED PURCHASE ORDERS & SUPPLIER PORTAL CLIENT
// ====================================================================

export async function fetchLiveSuppliers(): Promise<any[]> {
  try {
    const res = await authFetch('/api/v1/inventory/suppliers');
    const json = await res.json();
    return json.success && Array.isArray(json.data) ? json.data : [];
  } catch (err) {
    console.error('Failed to fetch suppliers', err);
    return [];
  }
}

export async function fetchLivePurchaseOrders(): Promise<any[]> {
  try {
    const res = await authFetch('/api/v1/inventory/purchase-orders');
    const json = await res.json();
    return json.success && Array.isArray(json.data) ? json.data : [];
  } catch (err) {
    console.error('Failed to fetch purchase orders', err);
    return [];
  }
}

export async function autoGeneratePurchaseOrder(params?: {
  items?: any[];
  supplierId?: string;
  notes?: string;
}): Promise<any> {
  const res = await authFetch('/api/v1/inventory/purchase-orders/auto-generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params || {}),
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || 'Failed to auto-generate purchase order');
  }
  return json.data;
}

export async function issuePurchaseOrder(poId: string): Promise<any> {
  const res = await authFetch(`/api/v1/inventory/purchase-orders/${poId}/issue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || 'Failed to issue purchase order');
  }
  return json.data;
}

export async function receivePurchaseOrder(poId: string): Promise<any> {
  const res = await authFetch(`/api/v1/inventory/purchase-orders/${poId}/receive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || 'Failed to inward purchase order goods');
  }
  return json.data;
}

export async function markOrderReadyForDelivery(orderId: string): Promise<any> {
  const res = await authFetch(`/api/v1/fulfillment/orders/${orderId}/ready-for-delivery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || 'Failed to mark order ready for delivery');
  }
  return json.data;
}
