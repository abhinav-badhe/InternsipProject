import React, { useState, useMemo } from 'react';
import {
  LayoutDashboard,
  Tag,
  Boxes,
  ShoppingCart,
  Percent,
  Star,
  Truck,
  RotateCcw,
  CreditCard,
  BarChart3,
  Store,
  Settings,
  Plus,
  Search,
  Pencil,
  ExternalLink,
  Sun,
  X,
  Check,
  AlertTriangle,
  ClipboardList,
  ShieldCheck,
  Send,
  Trash2,
  Clock,
} from 'lucide-react';

interface ListingItem {
  id: string;
  sku: string;
  title: string;
  brand: string;
  category: string;
  rating: number;
  ratingCount: number;
  currentPrice: number;
  originalPrice: number;
  stockCount: number;
  status: 'ACTIVE' | 'DRAFT' | 'INACTIVE';
  imageUrl: string;
}

export const App: React.FC = () => {
  const [activeNav, setActiveNav] = useState<string>('Listings');
  const [filterTab, setFilterTab] = useState<'All' | 'Active' | 'Draft' | 'Inactive'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isEditPriceOpen, setIsEditPriceOpen] = useState(false);
  const [isAdjustStockOpen, setIsAdjustStockOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState<ListingItem | null>(null);

  // Form states for modals
  const [editPriceValue, setEditPriceValue] = useState<string>('');
  const [adjustStockDelta, setAdjustStockDelta] = useState<string>('0');
  const [adjustReason, setAdjustReason] = useState<string>('RECEIPT');

  // New product form
  const [newTitle, setNewTitle] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [newSku, setNewSku] = useState('');
  const [newCategory, setNewCategory] = useState('Bathing Soaps');
  const [newPrice, setNewPrice] = useState('');
  const [newMrp, setNewMrp] = useState('');
  const [newStock, setNewStock] = useState('');

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Master Listings Dataset
  const [listings, setListings] = useState<ListingItem[]>([
    {
      id: 'lst-1',
      sku: 'DETTOL-ORIG-75G',
      title: 'Dettol Original Germ Protection Bathing Soap',
      brand: 'Dettol',
      category: 'Bathing Soaps',
      rating: 4.8,
      ratingCount: 1420,
      currentPrice: 38.0,
      originalPrice: 42.0,
      stockCount: 45,
      status: 'ACTIVE',
      imageUrl: 'https://images.unsplash.com/photo-1607006314144-8d9106fb3c9c?w=300&auto=format&fit=crop&q=80',
    },
    {
      id: 'lst-2',
      sku: 'DOVE-BAR-125G-4PK',
      title: 'Dove Cream Beauty Bar (4 x 125g)',
      brand: 'Dove',
      category: 'Bathing Soaps',
      rating: 4.9,
      ratingCount: 2310,
      currentPrice: 295.0,
      originalPrice: 340.0,
      stockCount: 1, // Scenario 01 Last Unit!
      status: 'ACTIVE',
      imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&auto=format&fit=crop&q=80',
    },
    {
      id: 'lst-3',
      sku: 'LIFEBUOY-RED-100G',
      title: 'Lifebuoy Total 10 Germ Protection Soap (100g)',
      brand: 'Lifebuoy',
      category: 'Bathing Soaps',
      rating: 4.6,
      ratingCount: 940,
      currentPrice: 32.0,
      originalPrice: 36.0,
      stockCount: 0, // Out of stock
      status: 'ACTIVE',
      imageUrl: 'https://images.unsplash.com/photo-1594913785162-e678a0c23dd9?w=300&auto=format&fit=crop&q=80',
    },
    {
      id: 'lst-4',
      sku: 'SURF-BAR-200G',
      title: 'Surf Excel Stain Eraser Detergent Bar (200g)',
      brand: 'Surf Excel',
      category: 'Laundry Detergents',
      rating: 4.8,
      ratingCount: 1890,
      currentPrice: 30.0,
      originalPrice: 35.0,
      stockCount: 50,
      status: 'ACTIVE',
      imageUrl: 'https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?w=300&auto=format&fit=crop&q=80',
    },
    {
      id: 'lst-5',
      sku: 'RIN-BAR-250G',
      title: 'Rin Advanced Supreme Brightness Detergent Bar',
      brand: 'Rin',
      category: 'Laundry Detergents',
      rating: 4.7,
      ratingCount: 1120,
      currentPrice: 24.0,
      originalPrice: 28.0,
      stockCount: 60,
      status: 'ACTIVE',
      imageUrl: 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?w=300&auto=format&fit=crop&q=80',
    },
    {
      id: 'lst-6',
      sku: 'VIM-BAR-200G',
      title: 'Vim Lemon Degreasing Dishwash Bar (200g)',
      brand: 'Vim',
      category: 'Dishwash & Cleaning',
      rating: 4.9,
      ratingCount: 3400,
      currentPrice: 25.0,
      originalPrice: 28.0,
      stockCount: 40,
      status: 'ACTIVE',
      imageUrl: 'https://images.unsplash.com/photo-1585670210693-e7fdd16b142e?w=300&auto=format&fit=crop&q=80',
    },
    {
      id: 'lst-7',
      sku: 'PRIL-GEL-425ML',
      title: 'Pril Lime Degreaser Dishwashing Gel (425ml)',
      brand: 'Pril',
      category: 'Dishwash & Cleaning',
      rating: 4.8,
      ratingCount: 1450,
      currentPrice: 110.0,
      originalPrice: 125.0,
      stockCount: 15,
      status: 'ACTIVE',
      imageUrl: 'https://images.unsplash.com/photo-1585670210693-e7fdd16b142e?w=300&auto=format&fit=crop&q=80',
    },
    {
      id: 'lst-8',
      sku: 'AMUL-MILK-1L',
      title: 'Amul Taaza Homogenised Toned Milk (1L)',
      brand: 'Amul',
      category: 'Dairy, Bread & Eggs',
      rating: 4.9,
      ratingCount: 4200,
      currentPrice: 74.0,
      originalPrice: 75.0,
      stockCount: 35,
      status: 'ACTIVE',
      imageUrl: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=300&auto=format&fit=crop&q=80',
    },
    {
      id: 'lst-9',
      sku: 'AASH-ATTA-5KG',
      title: 'Aashirvaad Shudh Chakki Whole Wheat Atta (5kg)',
      brand: 'Aashirvaad',
      category: 'Atta, Rice & Grains',
      rating: 4.9,
      ratingCount: 3890,
      currentPrice: 245.0,
      originalPrice: 275.0,
      stockCount: 25,
      status: 'ACTIVE',
      imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&auto=format&fit=crop&q=80',
    },
  ]);

  // Filtered Listings
  const filteredListings = useMemo(() => {
    return listings.filter((item) => {
      const matchesFilter =
        filterTab === 'All'
          ? true
          : filterTab === 'Active'
          ? item.status === 'ACTIVE'
          : filterTab === 'Draft'
          ? item.status === 'DRAFT'
          : item.status === 'INACTIVE';

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        q === '' ||
        item.title.toLowerCase().includes(q) ||
        item.brand.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q);

      return matchesFilter && matchesSearch;
    });
  }, [listings, filterTab, searchQuery]);

  // Actions
  const handleToggleActive = (id: string) => {
    setListings((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newStatus = item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
          showToast(`Listing ${item.sku} is now ${newStatus}`);
          return { ...item, status: newStatus };
        }
        return item;
      })
    );
  };

  const handleOpenEditPrice = (listing: ListingItem) => {
    setSelectedListing(listing);
    setEditPriceValue(listing.currentPrice.toString());
    setIsEditPriceOpen(true);
  };

  const handleSavePrice = () => {
    if (!selectedListing) return;
    const priceNum = parseFloat(editPriceValue);
    if (isNaN(priceNum) || priceNum <= 0) {
      alert('Please enter a valid price amount');
      return;
    }

    setListings((prev) =>
      prev.map((item) =>
        item.id === selectedListing.id ? { ...item, currentPrice: priceNum } : item
      )
    );
    showToast(`Updated price for ${selectedListing.sku} to ₹${priceNum.toFixed(2)} in Pricing Service`);
    setIsEditPriceOpen(false);
  };

  const handleOpenAdjustStock = (listing: ListingItem) => {
    setSelectedListing(listing);
    setAdjustStockDelta('10');
    setIsAdjustStockOpen(true);
  };

  const handleSaveStock = () => {
    if (!selectedListing) return;
    const deltaNum = parseInt(adjustStockDelta, 10);
    if (isNaN(deltaNum)) {
      alert('Please enter a valid stock delta');
      return;
    }

    setListings((prev) =>
      prev.map((item) => {
        if (item.id === selectedListing.id) {
          const newCount = Math.max(0, item.stockCount + deltaNum);
          return { ...item, stockCount: newCount };
        }
        return item;
      })
    );
    showToast(
      `Stock adjusted by ${deltaNum > 0 ? '+' : ''}${deltaNum} (${adjustReason}) in Inventory Service`
    );
    setIsAdjustStockOpen(false);
  };

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newSku || !newPrice) {
      alert('Please enter title, SKU, and price');
      return;
    }

    const priceNum = parseFloat(newPrice);
    const mrpNum = parseFloat(newMrp) || priceNum * 1.15;
    const stockNum = parseInt(newStock, 10) || 20;

    const newListing: ListingItem = {
      id: `lst-${Date.now()}`,
      sku: newSku.toUpperCase().trim(),
      title: newTitle,
      brand: newBrand || 'FreshCart Brands',
      category: newCategory,
      rating: 5.0,
      ratingCount: 1,
      currentPrice: priceNum,
      originalPrice: mrpNum,
      stockCount: stockNum,
      status: 'ACTIVE',
      imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=300&auto=format&fit=crop&q=80',
    };

    setListings([newListing, ...listings]);
    showToast(`Created new product listing ${newListing.sku} in Catalog Service`);
    setIsAddProductOpen(false);

    // Reset
    setNewTitle('');
    setNewBrand('');
    setNewSku('');
    setNewPrice('');
    setNewMrp('');
    setNewStock('');
  };

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans text-slate-800 antialiased selection:bg-emerald-100 selection:text-emerald-900">
      {/* 1. Left Sidebar (Matching user's reference image) */}
      <aside className="w-56 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0">
        <div>
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-100">
            <span className="font-semibold text-slate-900 text-sm tracking-tight block">
              Seller hub
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="p-2.5 space-y-0.5 text-xs">
            {[
              { name: 'Dashboard', icon: LayoutDashboard },
              { name: 'Listings', icon: Tag },
              { name: 'Inventory', icon: Boxes },
              { name: 'Orders', icon: ShoppingCart },
              { name: 'Promotions', icon: Percent },
              { name: 'Reviews', icon: Star },
              { name: 'Fulfillment', icon: Truck },
              { name: 'Returns', icon: RotateCcw },
              { name: 'Finance', icon: CreditCard },
              { name: 'Analytics', icon: BarChart3 },
              { name: 'Store setup', icon: Store },
              { name: 'Settings', icon: Settings },
            ].map((nav) => {
              const Icon = nav.icon;
              const isActive = activeNav === nav.name;
              return (
                <button
                  key={nav.name}
                  onClick={() => setActiveNav(nav.name)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors text-left ${
                    isActive
                      ? 'bg-slate-100 text-slate-900 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-slate-900' : 'text-slate-500'}`} />
                  <span>{nav.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Weather / Status widget (Matching screenshot) */}
        <div className="p-3 border-t border-slate-100 text-slate-500 text-[11px]">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-md text-slate-700 font-medium">
            <Sun className="w-3.5 h-3.5 text-amber-500" />
            <span>31°C Partly sunny</span>
          </div>
        </div>
      </aside>

      {/* 2. Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className="h-14 bg-white border-b border-slate-200 px-8 flex items-center justify-end">
          <a
            href="http://localhost:5173"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white font-medium text-xs transition-colors shadow-xs"
          >
            <span>View storefront</span>
            <ExternalLink className="w-3 h-3 text-emerald-200" />
          </a>
        </header>

        {/* Content Body */}
        <main className="flex-1 p-8 overflow-y-auto max-w-7xl w-full mx-auto">
          {/* Header Title & CTA Row */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Listings ({listings.length})
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Your offers with live prices and stock levels.
              </p>
            </div>

            <button
              onClick={() => setIsAddProductOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add product / listing</span>
            </button>
          </div>

          {/* Search Bar & Filter Pills (Exact layout from image) */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[280px] max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by product, brand, or SKU"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 transition-colors placeholder:text-slate-400"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 text-xs">
              {(['All', 'Active', 'Draft', 'Inactive'] as const).map((tab) => {
                const isSelected = filterTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setFilterTab(tab)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                      isSelected
                        ? 'bg-emerald-800 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3-Column Listing Cards Grid (Matching reference screenshot) */}
          {filteredListings.length === 0 ? (
            <div className="text-center py-16 bg-white border border-slate-200 rounded-lg">
              <p className="text-sm font-semibold text-slate-700 mb-1">No listings found</p>
              <p className="text-xs text-slate-500">Try adjusting your search query or filter pills.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredListings.map((item) => {
                const discount = Math.round(
                  ((item.originalPrice - item.currentPrice) / item.originalPrice) * 100
                );

                const isOutOfStock = item.stockCount === 0;
                const isLowStock = item.stockCount > 0 && item.stockCount <= 4;

                return (
                  <div
                    key={item.id}
                    className="bg-white border border-slate-200 rounded-lg p-3.5 flex flex-col justify-between hover:border-slate-300 transition-colors shadow-xs"
                  >
                    {/* Top Row: Thumbnail + Product Details + Status Badge */}
                    <div className="flex gap-3 mb-3">
                      {/* Image Thumbnail */}
                      <div className="w-16 h-20 rounded-md bg-slate-50 border border-slate-100 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="w-full h-full object-cover object-center rounded"
                          loading="lazy"
                        />
                      </div>

                      {/* Info & Title */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <h3 className="font-bold text-slate-900 text-xs leading-snug line-clamp-1">
                            {item.title}
                          </h3>

                          {/* Status Badge */}
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 uppercase tracking-wider ${
                              item.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {item.status}
                          </span>
                        </div>

                        {/* Rating & Brand */}
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 mb-0.5">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          <span className="font-semibold text-slate-700">{item.rating}</span>
                          <span>({item.ratingCount})</span>
                        </div>

                        {/* SKU */}
                        <div className="font-mono text-[10px] text-slate-400 tracking-wide">
                          {item.sku}
                        </div>
                      </div>
                    </div>

                    {/* Price & Discount Line */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-sm text-slate-900">
                        ₹{item.currentPrice.toFixed(2)}
                      </span>
                      {item.originalPrice > item.currentPrice && (
                        <span className="text-xs text-slate-400 line-through">
                          ₹{item.originalPrice.toFixed(2)}
                        </span>
                      )}
                      {discount > 0 && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-100 text-amber-900">
                          {discount}% off
                        </span>
                      )}
                    </div>

                    {/* Stock Level Indicator */}
                    <div className="text-xs mb-3">
                      {isOutOfStock ? (
                        <span className="text-rose-600 font-semibold">Out of stock</span>
                      ) : isLowStock ? (
                        <span className="text-amber-700 font-semibold">
                          Low stock • {item.stockCount} left
                        </span>
                      ) : (
                        <span className="text-slate-500">
                          In stock • <strong className="text-slate-700">{item.stockCount} units</strong>
                        </span>
                      )}
                    </div>

                    {/* Card Actions Bottom Row (Matching reference screenshot) */}
                    <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 font-medium">
                      <button
                        onClick={() => handleToggleActive(item.id)}
                        className="hover:text-slate-900 transition-colors"
                      >
                        {item.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      </button>

                      <button
                        onClick={() => handleOpenEditPrice(item)}
                        className="flex items-center gap-1 hover:text-slate-900 transition-colors"
                      >
                        <Pencil className="w-3 h-3 text-slate-400" />
                        <span>Price</span>
                      </button>

                      <button
                        onClick={() => handleOpenAdjustStock(item)}
                        className="hover:text-slate-900 transition-colors font-semibold"
                      >
                        Stock
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* 3. Modal: Edit Price (Pricing Service Integration) */}
      {isEditPriceOpen && selectedListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setIsEditPriceOpen(false)} />
          <div className="relative bg-white rounded-lg border border-slate-200 max-w-sm w-full p-5 shadow-xl z-10">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h3 className="font-bold text-sm text-slate-900">Edit Price</h3>
              <button onClick={() => setIsEditPriceOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Update effective-dated selling price for <strong className="text-slate-800">{selectedListing.sku}</strong>.
            </p>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">New Price (INR ₹)</label>
              <input
                type="number"
                step="0.01"
                value={editPriceValue}
                onChange={(e) => setEditPriceValue(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-emerald-600"
              />
            </div>
            <div className="flex justify-end gap-2 text-xs">
              <button
                onClick={() => setIsEditPriceOpen(false)}
                className="px-3 py-1.5 rounded text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePrice}
                className="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
              >
                Save Price
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Modal: Adjust Stock (Inventory Service Integration) */}
      {isAdjustStockOpen && selectedListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setIsAdjustStockOpen(false)} />
          <div className="relative bg-white rounded-lg border border-slate-200 max-w-sm w-full p-5 shadow-xl z-10">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h3 className="font-bold text-sm text-slate-900">Adjust Stock Balance</h3>
              <button onClick={() => setIsAdjustStockOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              PostgreSQL row-locked atomic ledger update for <strong className="text-slate-800">{selectedListing.sku}</strong>.
            </p>
            <div className="space-y-3 mb-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Adjustment Quantity (+ / -)</label>
                <input
                  type="number"
                  value={adjustStockDelta}
                  onChange={(e) => setAdjustStockDelta(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-emerald-600"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Movement Reason Code</label>
                <select
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-emerald-600"
                >
                  <option value="RECEIPT">RECEIPT (Stock Arrival from Supplier)</option>
                  <option value="ADJUSTMENT">ADJUSTMENT (Cycle Count Reconciliation)</option>
                  <option value="DAMAGE">DAMAGE (Damaged in Warehouse)</option>
                  <option value="EXPIRED">EXPIRED (Disposed Perishable Unit)</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 text-xs">
              <button
                onClick={() => setIsAdjustStockOpen(false)}
                className="px-3 py-1.5 rounded text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveStock}
                className="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
              >
                Confirm Ledger Movement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Modal: Add Product / Listing (Catalog Service Integration) */}
      {isAddProductOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setIsAddProductOpen(false)} />
          <div className="relative bg-white rounded-lg border border-slate-200 max-w-md w-full p-5 shadow-xl z-10">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h3 className="font-bold text-sm text-slate-900">Add Product / Listing</h3>
              <button onClick={() => setIsAddProductOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateProduct} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Product Title</label>
                <input
                  type="text"
                  placeholder="e.g. Pears Pure & Gentle Soap (125g)"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-emerald-600"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Brand</label>
                  <input
                    type="text"
                    placeholder="e.g. Pears"
                    value={newBrand}
                    onChange={(e) => setNewBrand(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">SKU Code</label>
                  <input
                    type="text"
                    placeholder="e.g. PEARS-PURE-125G"
                    value={newSku}
                    onChange={(e) => setNewSku(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-emerald-600 uppercase"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-emerald-600"
                >
                  <option value="Bathing Soaps">Bathing Soaps & Body Wash</option>
                  <option value="Laundry Detergents">Laundry Bars & Detergents</option>
                  <option value="Dishwash & Cleaning">Dishwash Bars & Liquids</option>
                  <option value="Dairy, Bread & Eggs">Dairy, Bread & Eggs</option>
                  <option value="Atta, Rice & Grains">Atta, Rice & Grains</option>
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="45.00"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-emerald-600"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">MRP (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="52.00"
                    value={newMrp}
                    onChange={(e) => setNewMrp(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Initial Units</label>
                  <input
                    type="number"
                    placeholder="25"
                    value={newStock}
                    onChange={(e) => setNewStock(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddProductOpen(false)}
                  className="px-3 py-1.5 rounded text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white font-semibold shadow-xs"
                >
                  Publish Listing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 bg-slate-900 text-white text-xs px-4 py-2.5 rounded-lg shadow-xl border border-slate-700 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
export default App;
