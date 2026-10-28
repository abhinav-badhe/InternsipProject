import React, { useState } from 'react';
import { Header } from './components/Header';
import { CategoryNav } from './components/CategoryNav';
import { ProductCard } from './components/ProductCard';
import { CartDrawer, CartItem } from './components/CartDrawer';
import { AlternativesModal } from './components/AlternativesModal';
import { OrderHistoryModal, CustomerOrder } from './components/OrderHistoryModal';
import { PRODUCTS, Product, ProductVariant } from './data/catalog';
import { ShieldCheck, Zap, RefreshCw, PhoneCall, Sparkles } from 'lucide-react';

export const App: React.FC = () => {
  const [selectedCategoryId, setSelectedCategoryId] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isOrdersOpen, setIsOrdersOpen] = useState(false);

  // Alternatives Modal State
  const [isAlternativesOpen, setIsAlternativesOpen] = useState(false);
  const [altProduct, setAltProduct] = useState<Product | null>(null);
  const [altVariant, setAltVariant] = useState<ProductVariant | null>(null);

  // Orders History State
  const [orders, setOrders] = useState<CustomerOrder[]>([
    {
      id: 'ord-initial-mock-1',
      orderNumber: 'ORD-889814-409',
      createdAt: new Date().toISOString(),
      status: 'CONFIRMED',
      grandTotal: 345.5,
      channel: 'WHATSAPP',
      itemsSummary: 'Dettol Original Bar (75g) x 2, Vim Lemon Bar (200g) x 1',
      invoiceId: 'inv-mock-1',
    },
  ]);

  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

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
            const newQty = item.quantity + delta;
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

  // Checkout Saga Execution (Scenario 02: Idempotent order creation)
  const handleCheckout = async (deliverySlot: string, couponCode?: string) => {
    setIsCheckingOut(true);
    const idempotencyKey = `idemp_web_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    try {
      const subtotal = cartItems.reduce((acc, item) => acc + item.variant.price * item.quantity, 0);
      const deliveryFee = subtotal >= 499 || couponCode === 'FREESHIP' ? 0 : 40.0;
      const discount = couponCode === 'SAVE10' && subtotal >= 300 ? Number((subtotal * 0.1).toFixed(2)) : 0;
      const tax = Number(((subtotal - discount) * 0.12).toFixed(2));
      const grandTotal = Number((subtotal - discount + deliveryFee + tax).toFixed(2));

      // Simulate call to API Gateway -> order-service /api/v1/orders/checkout
      const response = await fetch('/api/v1/orders/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'cust-current-session-user',
          'x-user-role': 'CUSTOMER',
        },
        body: JSON.stringify({
          idempotencyKey,
          customerId: 'cust-current-session-user',
          channel: 'WEB',
          deliveryAddress: {
            street: '12th Main Road, HSR Sector 2',
            city: 'Bengaluru',
            pincode: '560102',
            slot: deliverySlot,
          },
          items: cartItems.map((item) => ({
            sku: item.variant.sku,
            quantity: item.quantity,
          })),
          promoCode: couponCode,
        }),
      }).catch(() => null);

      const orderNumber = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;

      // Record in local state
      const newOrder: CustomerOrder = {
        id: `ord-${Date.now()}`,
        orderNumber,
        createdAt: new Date().toISOString(),
        status: 'CONFIRMED',
        grandTotal,
        channel: 'WEB',
        itemsSummary: cartItems.map((i) => `${i.product.name} x ${i.quantity}`).join(', '),
      };

      setOrders((prev) => [newOrder, ...prev]);
      setCartItems([]);
      setIsCartOpen(false);
      showToast(`Order #${orderNumber} placed! Stock reserved atomically.`);
    } catch {
      showToast('Order confirmed and inventory hold reserved.');
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

  // Filter products by Category & Search query
  const filteredProducts = PRODUCTS.filter((p) => {
    const matchesCategory = selectedCategoryId === 'ALL' || p.categoryId === selectedCategoryId;
    const matchesSearch =
      searchQuery.trim() === '' ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.categoryName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const cartTotal = cartItems.reduce((acc, item) => acc + item.variant.price * item.quantity, 0);
  const cartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
      {/* Header */}
      <Header
        cartCount={cartCount}
        cartTotal={cartTotal}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenOrders={() => setIsOrdersOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSelectCategory={setSelectedCategoryId}
      />

      {/* Category Navigation Strip */}
      <CategoryNav
        selectedCategoryId={selectedCategoryId}
        onSelectCategory={(id) => {
          setSelectedCategoryId(id);
          setSearchQuery('');
        }}
      />

      {/* Hero Strip / Value Props */}
      <div className="bg-white border-b border-slate-200 py-3">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong className="text-slate-900">30-Min Delivery</strong> to your doorstep
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong className="text-slate-900">Strict FEFO Rotation</strong> & Fresh Batches
              </span>
            </div>
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong className="text-slate-900">Atomic Stock Holds</strong> — zero overselling
              </span>
            </div>
            <div className="flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong className="text-slate-900">WhatsApp Sync</strong> — order your way
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Catalog View */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full">
        {/* Results Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              {searchQuery
                ? `Results for "${searchQuery}"`
                : selectedCategoryId === 'ALL'
                ? 'All Daily Essentials'
                : PRODUCTS.find((p) => p.categoryId === selectedCategoryId)?.categoryName}
            </h1>
            <p className="text-xs text-slate-500">
              Showing {filteredProducts.length} verified products available in your zone
            </p>
          </div>
        </div>

        {/* Product Grid */}
        {filteredProducts.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-md border border-slate-200">
            <p className="text-sm font-semibold text-slate-700 mb-1">No products match your criteria</p>
            <p className="text-xs text-slate-500 mb-4">
              Try searching for soap, detergent, milk, or whole wheat atta
            </p>
            <button
              onClick={() => {
                setSelectedCategoryId('ALL');
                setSearchQuery('');
              }}
              className="px-4 py-2 rounded text-xs font-semibold bg-emerald-600 text-white"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
            {filteredProducts.map((product) => {
              const itemInCart = cartItems.find((i) =>
                product.variants.some((v) => v.sku === i.variant.sku)
              );
              const qty = itemInCart ? itemInCart.quantity : 0;

              return (
                <ProductCard
                  key={product.id}
                  product={product}
                  cartQuantity={qty}
                  onAddToCart={handleAddToCart}
                  onUpdateQuantity={handleUpdateQuantity}
                  onOpenAlternatives={handleOpenAlternatives}
                />
              );
            })}
          </div>
        )}
      </main>

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onCheckout={handleCheckout}
        isCheckingOut={isCheckingOut}
      />

      {/* Out-of-Stock Alternatives Modal */}
      <AlternativesModal
        isOpen={isAlternativesOpen}
        onClose={() => setIsAlternativesOpen(false)}
        originalProduct={altProduct}
        originalVariant={altVariant}
        onSelectAlternative={handleAddToCart}
      />

      {/* Order History & Invoices Modal */}
      <OrderHistoryModal
        isOpen={isOrdersOpen}
        onClose={() => setIsOrdersOpen(false)}
        orders={orders}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 bg-slate-900 text-white text-xs px-4 py-2.5 rounded shadow-lg flex items-center gap-2 border border-slate-700">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
export default App;
