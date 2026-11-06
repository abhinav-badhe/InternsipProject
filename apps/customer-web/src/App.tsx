import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Header } from './components/Header';
import { CategoryNav } from './components/CategoryNav';
import { ProductCard } from './components/ProductCard';
import { CartDrawer, CartItem } from './components/CartDrawer';
import { AlternativesModal } from './components/AlternativesModal';
import type { CustomerOrder } from './components/OrderHistoryModal';
import { PRODUCTS, CATEGORIES, Product, ProductVariant, Category } from './data/catalog';
import { ShieldCheck, Zap, RefreshCw, PhoneCall, Sparkles, Database } from 'lucide-react';

// Lazy-loaded routes & heavy interactive modals (Code-Splitting for Instant Page Load)
const DeliveryPartnerApp = lazy(() => import('./components/DeliveryPartnerApp').then((m) => ({ default: m.DeliveryPartnerApp })));
const OrderHistoryModal = lazy(() => import('./components/OrderHistoryModal').then((m) => ({ default: m.OrderHistoryModal })));
const AuthModal = lazy(() => import('./components/AuthModal').then((m) => ({ default: m.AuthModal })));
const WalletModal = lazy(() => import('./components/WalletModal').then((m) => ({ default: m.WalletModal })));
const ReferralModal = lazy(() => import('./components/ReferralModal').then((m) => ({ default: m.ReferralModal })));
const SubscriptionModal = lazy(() => import('./components/SubscriptionModal').then((m) => ({ default: m.SubscriptionModal })));
const PaymentGatewayModal = lazy(() => import('./components/PaymentGatewayModal').then((m) => ({ default: m.PaymentGatewayModal })));
const RecipeBundlesModal = lazy(() => import('./components/RecipeBundlesModal').then((m) => ({ default: m.RecipeBundlesModal })));
const AddressSelectorModal = lazy(() => import('./components/AddressSelectorModal').then((m) => ({ default: m.AddressSelectorModal })));
import {
  fetchLiveCategories,
  fetchLiveProducts,
  fetchLiveCustomerOrders,
  executeRealCheckout,
  getCustomerSession,
  getStoredCustomerSession,
  signOutCustomer,
  AuthSession,
  fetchCustomerWallet,
  CustomerSavedAddress,
  fetchCustomerAddresses,
} from './api/client';

export const App: React.FC = () => {
  // 1. Dedicated Delivery Partner Route Guard & App Isolation
  const [currentPath, setCurrentPath] = useState<string>(
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (currentPath.startsWith('/delivery')) {
    return (
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-slate-900 text-white text-sm">Loading delivery fleet app...</div>}>
        <DeliveryPartnerApp />
      </Suspense>
    );
  }

  const [visibleProductCount, setVisibleProductCount] = useState(24);
  const [viewMode, setViewMode] = useState<'home' | 'browse'>('home');
  const [selectedCategoryId, setSelectedCategoryId] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [browseSearchInput, setBrowseSearchInput] = useState('');
  const [sortBy, setSortBy] = useState<'relevance' | 'price_asc' | 'price_desc' | 'rating' | 'name_asc'>('relevance');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isOrdersOpen, setIsOrdersOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>(CATEGORIES);
  const [products, setProducts] = useState<Product[]>(PRODUCTS);
  const [isBackendConnected, setIsBackendConnected] = useState(false);

  // Alternatives Modal State
  const [isAlternativesOpen, setIsAlternativesOpen] = useState(false);
  const [altProduct, setAltProduct] = useState<Product | null>(null);
  const [altVariant, setAltVariant] = useState<ProductVariant | null>(null);

  // Orders History State
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Feature 15: FreshCart Wallet & Cashback Modal State
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number>(0);

  // Feature 17: Referral Program Modal State
  const [isReferralOpen, setIsReferralOpen] = useState(false);

  // Feature 16: Daily Subscriptions Modal State
  const [isSubscriptionsOpen, setIsSubscriptionsOpen] = useState(false);

  // Feature 14: Recipe Bundles Modal State
  const [isRecipesOpen, setIsRecipesOpen] = useState(false);

  // Feature 21 & Feature 22: Payment Gateway & Split Payment Modal State
  const [selectedPaymentOrder, setSelectedPaymentOrder] = useState<CustomerOrder | null>(null);

  // Authentication & MFA State
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [userSession, setUserSession] = useState<AuthSession | null>(getStoredCustomerSession());

  // Delivery Address State
  const [selectedAddress, setSelectedAddress] = useState<CustomerSavedAddress | null>(null);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);

  useEffect(() => {
    fetchCustomerAddresses()
      .then((addrs) => {
        if (addrs && addrs.length > 0) {
          const def = addrs.find((a) => a.isDefault) || addrs[0];
          setSelectedAddress(def);
        }
      })
      .catch(() => {});
  }, [userSession]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleSignOut = () => {
    signOutCustomer();
    setUserSession(null);
    showToast('Signed out successfully.');
  };

  // REAL LIVE DATA FETCHING FROM POSTGRESQL ON MOUNT
  useEffect(() => {
    let isMounted = true;

    // 1. Fetch live categories immediately (Public, fast)
    fetchLiveCategories()
      .then((liveCats) => {
        if (isMounted && liveCats.length > 0) {
          setCategories(liveCats);
        }
      })
      .catch((err) => console.warn('[Storefront] Category fetch notice:', err));

    // 2. Fetch live products immediately (Public, fast)
    fetchLiveProducts()
      .then((liveProds) => {
        if (isMounted && liveProds.length > 0) {
          setProducts(liveProds);
          setIsBackendConnected(true);
          console.log(`[Storefront] Loaded ${liveProds.length} live products from database.`);
        }
      })
      .catch((err) => {
        console.warn('[Storefront] Falling back to offline catalog snapshot:', err);
      });

    // 3. User session & orders fetched gracefully in background
    getCustomerSession()
      .then((session) => {
        if (isMounted && session) {
          setUserSession(session);
          fetchLiveCustomerOrders()
            .then((liveOrders) => {
              if (isMounted && liveOrders.length > 0) {
                setOrders(liveOrders);
              }
            })
            .catch(() => {});
        }
      })
      .catch((err) => {
        console.info('[Storefront] Guest browsing active:', err?.message || err);
      });

    // 4. Feature 15: Fetch customer wallet & cashback balance
    fetchCustomerWallet()
      .then((w) => {
        if (isMounted) setWalletBalance(w.balance);
      })
      .catch(() => {});

    const params = new URLSearchParams(window.location.search);
    const payOrder = params.get('payOrder');
    const amt = params.get('amt');
    if (payOrder) {
      showToast(`Payment requested for Order #${payOrder} (₹${amt || ''})`);
      setIsOrdersOpen(true);
    }

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => { setVisibleProductCount(24); }, [searchQuery, selectedCategoryId, sortBy, inStockOnly]);

  // Cart Management
  const handleAddToCart = (variant: ProductVariant, product: Product) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.variant.sku === variant.sku);
      if (existing) {
        return prev.map((item) =>
          item.variant.sku === variant.sku
            ? { ...item, quantity: Math.min(item.quantity + 1, variant.availableStock) }
            : item
        );
      }
      return [...prev, { variant, product, quantity: 1 }];
    });
    showToast(`Added ${product.name} (${variant.packSize}) to cart`);
  };

  const handleUpdateQuantity = (sku: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) => {
          if (item.variant.sku === sku) {
            const newQty = Math.min(item.quantity + delta, item.variant.availableStock);
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const handleRemoveItem = (sku: string) => {
    setCartItems((prev) => prev.filter((item) => item.variant.sku !== sku));
    showToast('Item removed from cart');
  };

  // Real Checkout Saga Execution
  const handleCheckout = async (
    deliverySlot: string,
    couponCode?: string,
    deliveryAddress?: any,
    paymentMethod: 'RAZORPAY' | 'COD' = 'RAZORPAY'
  ) => {
    if (cartItems.length === 0) return;
    setIsCheckingOut(true);

    try {
      const checkoutItems = cartItems.map((item) => ({
        sku: item.variant.sku,
        quantity: item.quantity,
      }));

      const orderData = await executeRealCheckout({
        items: checkoutItems,
        deliverySlot,
        couponCode,
        deliveryAddress,
        paymentMethod,
      });

      const newOrder: CustomerOrder = {
        id: orderData.orderId,
        orderNumber: orderData.orderNumber,
        createdAt: orderData.createdAt || new Date().toISOString(),
        status: orderData.status,
        grandTotal: orderData.grandTotal,
        channel: orderData.channel,
        itemsSummary: cartItems.map((i) => `${i.product.name} x ${i.quantity}`).join(', '),
        invoiceId: `inv-${orderData.orderId}`,
      };

      setOrders((prev) => [newOrder, ...prev]);
      setCartItems([]);
      setIsCartOpen(false);

      if (paymentMethod === 'RAZORPAY' && orderData.grandTotal > 0) {
        setSelectedPaymentOrder(newOrder);
      } else {
        showToast(`Order #${orderData.orderNumber} placed! Pay cash on delivery.`);
      }
    } catch (err: any) {
      showToast(`Checkout Error: ${err.message}`);
    } finally {
      setIsCheckingOut(false);
    }
  };

  // Open Alternatives Dialog
  const handleOpenAlternatives = (product: Product, variant: ProductVariant) => {
    setAltProduct(product);
    setAltVariant(variant);
    setIsAlternativesOpen(true);
  };

  // Filter & sort products by Category, Search query, and Stock Status (Live PostgreSQL Data)
  const filteredProducts = products
    .filter((p) => {
      const selectedCat = categories.find((c) => c.id === selectedCategoryId);
      const matchesCategory =
        selectedCategoryId === 'ALL' ||
        p.categoryId === selectedCategoryId ||
        (selectedCat && p.categoryName && p.categoryName.toLowerCase() === selectedCat.name.toLowerCase());
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        q === '' ||
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.categoryName.toLowerCase().includes(q) ||
        p.variants.some(
          (v) =>
            v.sku.toLowerCase().includes(q) ||
            v.name.toLowerCase().includes(q) ||
            v.packSize.toLowerCase().includes(q)
        );

      const matchesStock = !inStockOnly || p.variants.some((v) => v.availableStock > 0);

      return matchesCategory && matchesSearch && matchesStock;
    })
    .sort((a, b) => {
      const getMinPrice = (prod: Product) => {
        if (!prod.variants || prod.variants.length === 0) return 0;
        const prices = prod.variants.map((v) => Number(v.price) || 0).filter((p) => p > 0);
        return prices.length > 0 ? Math.min(...prices) : 0;
      };

      if (sortBy === 'price_asc') {
        return getMinPrice(a) - getMinPrice(b);
      }
      if (sortBy === 'price_desc') {
        return getMinPrice(b) - getMinPrice(a);
      }
      if (sortBy === 'rating') {
        return (b.rating || 0) - (a.rating || 0);
      }
      if (sortBy === 'name_asc') {
        return a.name.localeCompare(b.name);
      }
      return 0; // relevance
    });

  // Category product counts for filter sidebar
  const categoryCounts = categories.reduce<Record<string, number>>((acc, cat) => {
    acc[cat.id] = products.filter(
      (p) =>
        p.categoryId === cat.id ||
        (cat.name && p.categoryName && p.categoryName.toLowerCase() === cat.name.toLowerCase())
    ).length;
    return acc;
  }, {});

  const cartQuantities = Object.fromEntries(cartItems.map((item) => [item.variant.sku, item.quantity]));
  const cartTotal = cartItems.reduce((acc, item) => acc + item.variant.price * item.quantity, 0);
  const cartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  const handleBrowseSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSearchQuery(browseSearchInput);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans">
      {/* 1. Top Header with Browse Products Button */}
      <Header
        cartCount={cartCount}
        cartTotal={cartTotal}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenOrders={() => setIsOrdersOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={(q) => {
          setSearchQuery(q);
          setBrowseSearchInput(q);
        }}
        onSelectCategory={(id) => {
          setSelectedCategoryId(id);
          setViewMode('browse');
        }}
        isBrowseMode={viewMode === 'browse'}
        onToggleBrowse={(mode) => {
          if (mode) setViewMode(mode);
          else setViewMode((prev) => (prev === 'browse' ? 'home' : 'browse'));
        }}
        userSession={userSession}
        onOpenAuth={() => setIsAuthOpen(true)}
        onSignOut={handleSignOut}
        walletBalance={walletBalance}
        onOpenWallet={() => setIsWalletOpen(true)}
        onOpenReferral={() => setIsReferralOpen(true)}
        onOpenSubscriptions={() => setIsSubscriptionsOpen(true)}
        onOpenRecipes={() => setIsRecipesOpen(true)}
        selectedAddress={selectedAddress}
        onOpenAddressModal={() => setIsAddressModalOpen(true)}
      />

      {!isBackendConnected && <div role="status" className="border-b border-border bg-surface-muted px-4 py-1.5 text-center text-xs text-muted-foreground">Catalog preview · Prices and availability are sample data.</div>}

      {/* 2. Top Slider Category Strip (Visible on Home view) */}
      {viewMode === 'home' && (
        <CategoryNav
          categories={categories}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={(id) => {
            setSelectedCategoryId(id);
            setSearchQuery('');
            setBrowseSearchInput('');
          }}
        />
      )}

      {/* 3. Main Views */}
      {viewMode === 'browse' ? (
        /* DEDICATED SEARCH & FILTER BROWSE PAGE MATCHING REFERENCE IMAGE */
        <main id="main-content" tabIndex={-1} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full">
          {/* Page Title */}
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight mb-4">
            Search products
          </h1>

          {/* Search Bar matching image */}
          <form
            onSubmit={handleBrowseSearchSubmit}
            className="flex items-center gap-2 max-w-2xl mb-6"
          >
            <input
              aria-label="Search by title, brand, category, or SKU"
              type="search"
              placeholder="Search by title, brand, category, or SKU"
              value={browseSearchInput}
              onChange={(e) => {
                setBrowseSearchInput(e.target.value);
                setSearchQuery(e.target.value); // Real-time live search filter!
              }}
              className="flex-1 min-w-0 px-3.5 py-3 text-sm bg-surface border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all placeholder:text-gray-400 "
            />
            <button
              type="submit"
              className="min-h-11 px-5 py-2 rounded-md text-sm font-semibold bg-primary text-white hover:bg-primary-hover transition-colors cursor-pointer shrink-0"
            >
              Search
            </button>
          </form>

          {/* Two-Column Responsive Flex Layout (Prevents Overflow & Squeezing) */}
          <div className="flex flex-col md:flex-row gap-6 items-start">
            {/* Left Filter Sidebar */}
            <aside className="w-full md:w-56 shrink-0 space-y-4 md:sticky md:top-40">
              {/* Card 1: Sort by & Stock Filter */}
              <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-900 mb-1.5">
                    Sort by
                  </label>
                  <select
                    aria-label="Sort products"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="w-full px-2.5 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-gray-800 cursor-pointer font-medium"
                  >
                    <option value="relevance">Relevance</option>
                    <option value="price_asc">Price: Low to High</option>
                    <option value="price_desc">Price: High to Low</option>
                    <option value="rating">Rating</option>
                    <option value="name_asc">Name: A to Z</option>
                  </select>
                </div>

                <div className="pt-2.5 border-t border-gray-100">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={inStockOnly}
                      onChange={(e) => setInStockOnly(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                    />
                    <span className="text-xs text-gray-700 font-medium">In stock only</span>
                  </label>
                </div>
              </div>

              {/* Card 2: Categories List */}
              <div className="bg-surface border border-border rounded-lg p-4 ">
                <h3 className="text-xs font-semibold text-gray-900 mb-2">Categories</h3>
                <div className="space-y-0.5 text-xs max-h-60 md:max-h-[460px] overflow-y-auto overscroll-y-contain pr-2">
                  <button
                    onClick={() => setSelectedCategoryId('ALL')}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                      selectedCategoryId === 'ALL'
                        ? 'text-primary font-bold bg-emerald-50'
                        : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <span>All categories</span>
                    <span className="text-gray-400 font-normal">({products.length})</span>
                  </button>

                  {categories
                    .filter((cat) => cat.id.toUpperCase() !== 'ALL' && cat.name.toLowerCase() !== 'all products')
                    .map((cat) => {
                      const count = categoryCounts[cat.id] ?? 0;
                      const isActive = selectedCategoryId === cat.id;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => setSelectedCategoryId(cat.id)}
                          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                            isActive
                              ? 'text-primary font-bold bg-emerald-50'
                              : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                          }`}
                        >
                          <span className="truncate pr-2 font-medium">{cat.name}</span>
                          <span className="text-gray-400 font-normal shrink-0">({count})</span>
                        </button>
                      );
                    })}
                </div>
              </div>
            </aside>

            {/* Right Product Grid Area */}
            <section className="flex-1 min-w-0 w-full">
              <div className="flex items-center justify-between mb-3 text-xs text-gray-500 font-medium">
                <span>
                  Showing {filteredProducts.length} of {products.length} products
                </span>
                {(selectedCategoryId !== 'ALL' || searchQuery || inStockOnly || sortBy !== 'relevance') && (
                  <button
                    onClick={() => {
                      setSelectedCategoryId('ALL');
                      setSearchQuery('');
                      setBrowseSearchInput('');
                      setInStockOnly(false);
                      setSortBy('relevance');
                    }}
                    className="text-xs text-primary font-semibold hover:underline cursor-pointer"
                  >
                    Reset all filters
                  </button>
                )}
              </div>

              {filteredProducts.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl border border-gray-200 ">
                  <p className="text-sm font-semibold text-gray-700 mb-1">
                    No products match your criteria
                  </p>
                  <p className="text-xs text-gray-500 mb-4">
                    Try searching for butter, soap, toothpaste, bread, or salt
                  </p>
                  <button
                    onClick={() => {
                      setSelectedCategoryId('ALL');
                      setSearchQuery('');
                      setBrowseSearchInput('');
                      setInStockOnly(false);
                    }}
                    className="px-4 py-2 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-primary-hover transition-colors cursor-pointer"
                  >
                    Reset Filters
                  </button>
                </div>
              ) : (
                /* 3-Column Product Grid matching reference image */
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {filteredProducts.slice(0, visibleProductCount).map((product) => {

                    return (
                      <ProductCard
                        key={product.id}
                        product={product}
                        cartQuantities={cartQuantities}
                        onAddToCart={handleAddToCart}
                        onUpdateQuantity={handleUpdateQuantity}
                        onOpenAlternatives={handleOpenAlternatives}
                      />
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </main>
      ) : (
        /* HOME CATALOG VIEW */
        <main id="main-content" tabIndex={-1} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex-1 w-full">
          {/* Results / Available Now Section Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div className="flex items-baseline gap-2">
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                {searchQuery ? `Results for "${searchQuery}"` : 'Available now'}
              </h1>
            </div>
            <button
              onClick={() => {
                setViewMode('browse');
              }}
              className="text-xs font-semibold text-primary hover:text-primary-hover transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>Browse & Filter ({filteredProducts.length})</span>
              <span>&rarr;</span>
            </button>
          </div>

          {/* 4-Column Product Grid for Home */}
          {filteredProducts.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-200 ">
              <p className="text-sm font-semibold text-gray-700 mb-1">
                No products match your criteria
              </p>
              <p className="text-xs text-gray-500 mb-4">
                Try searching for butter, soap, toothpaste, bread, or salt
              </p>
              <button
                onClick={() => {
                  setSelectedCategoryId('ALL');
                  setSearchQuery('');
                  setBrowseSearchInput('');
                }}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-primary-hover transition-colors"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {filteredProducts.slice(0, visibleProductCount).map((product) => {

                return (
                  <ProductCard
                    key={product.id}
                    product={product}
                    cartQuantities={cartQuantities}
                    onAddToCart={handleAddToCart}
                    onUpdateQuantity={handleUpdateQuantity}
                    onOpenAlternatives={handleOpenAlternatives}
                  />
                );
              })}
            </div>
          )}
        </main>
      )}

      {filteredProducts.length > visibleProductCount && (
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-center gap-3 px-4 pb-8 text-xs text-muted-foreground">
          <span>Showing {visibleProductCount} of {filteredProducts.length} products</span>
          <button onClick={() => setVisibleProductCount((count) => count + 24)} className="min-h-11 rounded-md border border-border bg-surface px-4 font-semibold text-foreground transition-colors hover:bg-surface-muted">Show more products</button>
        </div>
      )}

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onCheckout={handleCheckout}
        isCheckingOut={isCheckingOut}
        onAddToCart={handleAddToCart}
      />

      {/* Out-of-Stock Alternatives Modal */}
      <AlternativesModal
        isOpen={isAlternativesOpen}
        onClose={() => setIsAlternativesOpen(false)}
        originalProduct={altProduct}
        originalVariant={altVariant}
        onSelectAlternative={handleAddToCart}
      />

      {/* Lazy-Loaded Interactive Modals & Features */}
      <Suspense fallback={null}>
        {/* Order History & Invoices Modal */}
        <OrderHistoryModal
          isOpen={isOrdersOpen}
          onClose={() => setIsOrdersOpen(false)}
          orders={orders}
          walletBalance={walletBalance}
        />

        {/* Feature 21 & Feature 22: Live Payment Gateway & Split Payment Modal */}
        {selectedPaymentOrder && (
          <PaymentGatewayModal
            isOpen={Boolean(selectedPaymentOrder)}
            onClose={() => setSelectedPaymentOrder(null)}
            orderId={selectedPaymentOrder.id}
            orderNumber={selectedPaymentOrder.orderNumber}
            totalAmount={selectedPaymentOrder.grandTotal}
            walletBalance={walletBalance}
            onPaymentSuccess={(paymentId) => {
              setOrders((prev) =>
                prev.map((o) => (o.id === selectedPaymentOrder.id ? { ...o, status: 'CONFIRMED' } : o))
              );
              fetchCustomerWallet().then((w) => setWalletBalance(w.balance)).catch(() => {});
              showToast(`🎉 Payment Confirmed! Order #${selectedPaymentOrder.orderNumber} is packing at dark store.`);
            }}
          />
        )}

        {/* Sign In / Register / MFA Modal */}
        <AuthModal
          isOpen={isAuthOpen}
          onClose={() => setIsAuthOpen(false)}
          onSuccess={(session) => {
            setUserSession(session);
            showToast(`Welcome back, ${session.user.fullName}!`);
          }}
        />

        {/* Feature 15: FreshCart Customer Wallet & Cashback Modal */}
        <WalletModal
          isOpen={isWalletOpen}
          onClose={() => setIsWalletOpen(false)}
          onBalanceUpdated={(newBal) => setWalletBalance(newBal)}
        />

        {/* Feature 17: FreshCart Refer & Earn Modal */}
        <ReferralModal
          isOpen={isReferralOpen}
          onClose={() => setIsReferralOpen(false)}
          onRewardClaimed={() => {
            fetchCustomerWallet().then((w) => setWalletBalance(w.balance)).catch(() => {});
            showToast('🎉 ₹100 Welcome Gift credited to your wallet!');
          }}
        />

        {/* Feature 16: Daily Essentials & Milk Subscription Modal */}
        <SubscriptionModal
          products={products}
          isOpen={isSubscriptionsOpen}
          onClose={() => setIsSubscriptionsOpen(false)}
          onSubscriptionChanged={() => {
            showToast('Updated your morning recurring subscription.');
          }}
        />

        {/* Feature 14: Cook & Shop Recipe Bundles Modal */}
        <RecipeBundlesModal
          isOpen={isRecipesOpen}
          onClose={() => setIsRecipesOpen(false)}
          products={products}
          onAddIngredient={handleAddToCart}
          onShowToast={showToast}
        />

        {/* Customer Saved Delivery Addresses Management Modal */}
        <AddressSelectorModal
          isOpen={isAddressModalOpen}
          onClose={() => setIsAddressModalOpen(false)}
          selectedAddress={selectedAddress}
          onSelectAddress={(addr) => {
            setSelectedAddress(addr);
            showToast(`📍 Selected ${addr.label} (${addr.street}) as delivery address`);
          }}
        />
      </Suspense>

      {/* Toast Notification */}
      {toastMessage && (
        <div role="status" aria-live="polite" className="fixed bottom-4 left-4 sm:left-auto right-4 z-50 bg-slate-900 text-white text-xs px-4 py-2.5 rounded shadow-lg flex items-center gap-2 border border-slate-700">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
export default App;
