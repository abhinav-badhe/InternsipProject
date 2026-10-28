import React, { useState } from 'react';
import {
  LayoutDashboard,
  Layers,
  Boxes,
  ShoppingCart,
  Tag,
  Star,
  Truck,
  RotateCcw,
  Receipt,
  TrendingUp,
  Store,
  Settings,
  Search,
  Plus,
  Minus,
  ExternalLink,
  Check,
  X,
  Filter,
  PackagePlus,
  SlidersHorizontal,
  ChevronRight,
  Eye,
  Printer,
  Calendar,
  AlertTriangle,
  ArrowRightLeft,
  Sparkles,
  ShoppingBag,
  Clock,
  Phone,
} from 'lucide-react';

// ==========================================
// 1. DATA TYPES (Strict Database Schema 001)
// ==========================================

export interface CategoryDef {
  id: string;
  name: string;
  parentName: string;
  slug: string;
  defaultHsn: string;
  defaultZone: string;
  defaultImage: string;
  sampleBrands: string[];
}

export interface ProductVariant {
  sku: string;
  productName: string;
  brand: string;
  categoryId: string;
  categoryName: string;
  packSize: string;
  mrp: number;
  price: number;
  stock: number;
  reserved: number;
  zone: string;
  imageUrl: string;
  storageType?: string;
  shelfLifeDays?: number;
  isVeg?: boolean;
  hsnCode?: string;
  barcode?: string;
}

export interface OrderRecord {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  channel: 'WEB' | 'WHATSAPP';
  status: 'PENDING_PAYMENT' | 'CONFIRMED' | 'PACKED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';
  grandTotal: number;
  subtotal: number;
  taxTotal: number;
  deliveryFee: number;
  createdAt: string;
  items: {
    sku: string;
    productName: string;
    variantName: string;
    quantity: number;
    unitPrice: number;
    hsnCode: string;
  }[];
}

export interface PickListTask {
  id: string;
  orderNumber: string;
  zone: string;
  sku: string;
  productName: string;
  batchNumber: string;
  quantity: number;
  status: 'PENDING' | 'PICKED' | 'SUBSTITUTION_PROPOSED';
  substituteSku?: string;
  substituteName?: string;
  substituteDecision?: 'PENDING' | 'ACCEPTED' | 'REJECTED';
}

export interface InvoiceRecord {
  invoiceId: string;
  invoiceNumber: string;
  orderNumber: string;
  customerName: string;
  customerGstin?: string;
  currency: string;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  totalTax: number;
  grandTotal: number;
  createdAt: string;
  items: {
    hsn: string;
    description: string;
    qty: number;
    rate: number;
    cgstRate: number;
    sgstRate: number;
    amount: number;
  }[];
}

// ==========================================
// 2. MASTER CATEGORIES & SEED PRODUCTS
// ==========================================

export const MASTER_CATEGORIES: CategoryDef[] = [
  {
    id: '11000000-0000-0000-0000-000000000001',
    name: 'Bathing Soaps & Body Wash',
    parentName: 'Personal Care',
    slug: 'bathing-soaps',
    defaultHsn: '34011110',
    defaultZone: 'Zone A-01',
    defaultImage: 'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=300&auto=format&fit=crop&q=80',
    sampleBrands: ['Dettol', 'Dove', 'Lifebuoy', 'Pears', 'Lux', 'Fiama'],
  },
  {
    id: '11000000-0000-0000-0000-000000000002',
    name: 'Washing Soaps & Detergent Bars',
    parentName: 'Household & Laundry',
    slug: 'washing-soaps',
    defaultHsn: '34022010',
    defaultZone: 'Zone B-01',
    defaultImage: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=300&auto=format&fit=crop&q=80',
    sampleBrands: ['Surf Excel', 'Rin', 'Tide', 'Wheel', 'Henko'],
  },
  {
    id: '11000000-0000-0000-0000-000000000003',
    name: 'Dishwashing & Utensil Soaps',
    parentName: 'Kitchen & Dishwashing',
    slug: 'utensil-soaps',
    defaultHsn: '34029010',
    defaultZone: 'Zone B-04',
    defaultImage: 'https://images.unsplash.com/photo-1585421514738-01798e348b17?w=300&auto=format&fit=crop&q=80',
    sampleBrands: ['Vim', 'Pril', 'Exo', 'Genteel'],
  },
  {
    id: '11000000-0000-0000-0000-000000000004',
    name: 'Milk & Dairy Essentials',
    parentName: 'Dairy & Eggs',
    slug: 'milk-dairy',
    defaultHsn: '04012000',
    defaultZone: 'Cold-01',
    defaultImage: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=300&auto=format&fit=crop&q=80',
    sampleBrands: ['Amul', 'Nandini', 'Mother Dairy', 'Britannia'],
  },
  {
    id: '11000000-0000-0000-0000-000000000005',
    name: 'Atta, Rice & Grains',
    parentName: 'Staples & Flours',
    slug: 'atta-rice-staples',
    defaultHsn: '11010000',
    defaultZone: 'Zone A-05',
    defaultImage: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&auto=format&fit=crop&q=80',
    sampleBrands: ['Aashirvaad', 'Fortune', 'India Gate', 'Tata Sampann'],
  },
];

const INITIAL_VARIANTS: ProductVariant[] = [
  {
    sku: 'DETTOL-ORIG-75G',
    productName: 'Dettol Original Germ Protection Bathing Soap',
    brand: 'Dettol',
    categoryId: '11000000-0000-0000-0000-000000000001',
    categoryName: 'Bathing Soaps & Body Wash',
    packSize: '75g Bar',
    mrp: 42.0,
    price: 38.0,
    stock: 45,
    reserved: 2,
    zone: 'Zone A-01-R3',
    imageUrl: 'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=300&auto=format&fit=crop&q=80',
    hsnCode: '34011110',
    barcode: '8901030010021',
  },
  {
    sku: 'DOVE-BAR-125G-4PK',
    productName: 'Dove Cream Beauty Bathing Bar',
    brand: 'Dove',
    categoryId: '11000000-0000-0000-0000-000000000001',
    categoryName: 'Bathing Soaps & Body Wash',
    packSize: '4 × 125g Pack',
    mrp: 340.0,
    price: 295.0,
    stock: 1,
    reserved: 0,
    zone: 'Zone A-02-R1',
    imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&auto=format&fit=crop&q=80',
    hsnCode: '34011110',
    barcode: '8901030010043',
  },
  {
    sku: 'PEARS-PURE-125G',
    productName: 'Pears Pure & Gentle Bathing Bar',
    brand: 'Pears',
    categoryId: '11000000-0000-0000-0000-000000000001',
    categoryName: 'Bathing Soaps & Body Wash',
    packSize: '125g Single Bar',
    mrp: 65.0,
    price: 58.0,
    stock: 50,
    reserved: 0,
    zone: 'Zone A-01-R4',
    imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&auto=format&fit=crop&q=80',
    hsnCode: '34011110',
    barcode: '8901030010088',
  },
  {
    sku: 'LIFEBUOY-RED-100G',
    productName: 'Lifebuoy Total 10 Germ Protection Soap',
    brand: 'Lifebuoy',
    categoryId: '11000000-0000-0000-0000-000000000001',
    categoryName: 'Bathing Soaps & Body Wash',
    packSize: '100g Bar',
    mrp: 36.0,
    price: 32.0,
    stock: 0,
    reserved: 0,
    zone: 'Zone A-03-R2',
    imageUrl: 'https://images.unsplash.com/photo-1590439471364-192aa70c0b53?w=300&auto=format&fit=crop&q=80',
    hsnCode: '34011110',
    barcode: '8901030010065',
  },
  {
    sku: 'SURF-BAR-200G',
    productName: 'Surf Excel Stain Eraser Detergent Bar',
    brand: 'Surf Excel',
    categoryId: '11000000-0000-0000-0000-000000000002',
    categoryName: 'Washing Soaps & Detergent Bars',
    packSize: '200g Bar',
    mrp: 35.0,
    price: 30.0,
    stock: 50,
    reserved: 4,
    zone: 'Zone B-01-R2',
    imageUrl: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=300&auto=format&fit=crop&q=80',
    hsnCode: '34022010',
    barcode: '8901030020011',
  },
  {
    sku: 'RIN-BAR-250G',
    productName: 'Rin Advanced Supreme Brightness Bar',
    brand: 'Rin',
    categoryId: '11000000-0000-0000-0000-000000000002',
    categoryName: 'Washing Soaps & Detergent Bars',
    packSize: '250g Bar',
    mrp: 28.0,
    price: 24.0,
    stock: 60,
    reserved: 0,
    zone: 'Zone B-02-R1',
    imageUrl: 'https://images.unsplash.com/photo-1545127398-14699f92334b?w=300&auto=format&fit=crop&q=80',
    hsnCode: '34022010',
    barcode: '8901030020028',
  },
  {
    sku: 'VIM-BAR-200G',
    productName: 'Vim Lemon Degreasing Dishwash Bar',
    brand: 'Vim',
    categoryId: '11000000-0000-0000-0000-000000000003',
    categoryName: 'Dishwashing & Utensil Soaps',
    packSize: '200g Bar',
    mrp: 28.0,
    price: 25.0,
    stock: 40,
    reserved: 1,
    zone: 'Zone B-04-R1',
    imageUrl: 'https://images.unsplash.com/photo-1585421514738-01798e348b17?w=300&auto=format&fit=crop&q=80',
    hsnCode: '34029010',
    barcode: '8901030030010',
  },
  {
    sku: 'AMUL-MILK-1L',
    productName: 'Amul Taaza Homogenised Toned Milk',
    brand: 'Amul',
    categoryId: '11000000-0000-0000-0000-000000000004',
    categoryName: 'Milk & Dairy Essentials',
    packSize: '1 Litre Tetra',
    mrp: 75.0,
    price: 74.0,
    stock: 35,
    reserved: 0,
    zone: 'Cold-01-ShelfA',
    imageUrl: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=300&auto=format&fit=crop&q=80',
    hsnCode: '04012000',
    barcode: '8901262010105',
  },
  {
    sku: 'AASH-ATTA-5KG',
    productName: 'Aashirvaad Shudh Chakki Whole Wheat Atta',
    brand: 'Aashirvaad',
    categoryId: '11000000-0000-0000-0000-000000000005',
    categoryName: 'Atta, Rice & Grains',
    packSize: '5 kg Bag',
    mrp: 290.0,
    price: 259.0,
    stock: 25,
    reserved: 2,
    zone: 'Zone A-05-R1',
    imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&auto=format&fit=crop&q=80',
    hsnCode: '11010000',
    barcode: '8901030050019',
  },
];

const INITIAL_ORDERS: OrderRecord[] = [
  {
    id: 'ord-101',
    orderNumber: 'ORD-889814-409',
    customerId: 'cust-wh-919876543210',
    customerName: 'Rohit Verma',
    customerPhone: '+91 98765 43210',
    channel: 'WHATSAPP',
    status: 'CONFIRMED',
    grandTotal: 345.5,
    subtotal: 288.0,
    taxTotal: 37.5,
    deliveryFee: 20.0,
    createdAt: 'Today, 5:42 PM',
    items: [
      {
        sku: 'DETTOL-ORIG-75G',
        productName: 'Dettol Original Bathing Soap',
        variantName: '75g Bar',
        quantity: 2,
        unitPrice: 38.0,
        hsnCode: '34011110',
      },
      {
        sku: 'SURF-BAR-200G',
        productName: 'Surf Excel Detergent Bar',
        variantName: '200g Bar',
        quantity: 1,
        unitPrice: 30.0,
        hsnCode: '34022010',
      },
      {
        sku: 'AASH-ATTA-5KG',
        productName: 'Aashirvaad Whole Wheat Atta',
        variantName: '5kg Bag',
        quantity: 1,
        unitPrice: 259.0,
        hsnCode: '11010000',
      },
    ],
  },
  {
    id: 'ord-102',
    orderNumber: 'ORD-772910-108',
    customerId: 'cust-web-ananya',
    customerName: 'Ananya Sharma',
    customerPhone: '+91 91234 56789',
    channel: 'WEB',
    status: 'PACKED',
    grandTotal: 334.8,
    subtotal: 295.0,
    taxTotal: 39.8,
    deliveryFee: 0.0,
    createdAt: 'Today, 4:30 PM',
    items: [
      {
        sku: 'DOVE-BAR-125G-4PK',
        productName: 'Dove Cream Beauty Bar',
        variantName: '4 × 125g Pack',
        quantity: 1,
        unitPrice: 295.0,
        hsnCode: '34011110',
      },
    ],
  },
];

const INITIAL_PICK_TASKS: PickListTask[] = [
  {
    id: 'pick-01',
    orderNumber: 'ORD-889814-409',
    zone: 'Zone A - Packaged',
    sku: 'DETTOL-ORIG-75G',
    productName: 'Dettol Original Bathing Soap (75g)',
    batchNumber: 'BATCH-2026-DETTOL-09',
    quantity: 2,
    status: 'PICKED',
  },
  {
    id: 'pick-02',
    orderNumber: 'ORD-889814-409',
    zone: 'Zone B - Detergents',
    sku: 'SURF-BAR-200G',
    productName: 'Surf Excel Detergent Bar (200g)',
    batchNumber: 'BATCH-2026-SURF-12',
    quantity: 1,
    status: 'PENDING',
  },
  {
    id: 'pick-03',
    orderNumber: 'ORD-772910-108',
    zone: 'Zone A - Packaged',
    sku: 'LIFEBUOY-RED-100G',
    productName: 'Lifebuoy Total 10 Soap (100g)',
    batchNumber: 'BATCH-2026-LIFE-01',
    quantity: 1,
    status: 'SUBSTITUTION_PROPOSED',
    substituteSku: 'DETTOL-ORIG-75G',
    substituteName: 'Dettol Original Bathing Soap (75g)',
    substituteDecision: 'PENDING',
  },
];

const INITIAL_INVOICES: InvoiceRecord[] = [
  {
    invoiceId: 'INV-2026-0091',
    invoiceNumber: 'INV/2026/0091',
    orderNumber: 'ORD-889814-409',
    customerName: 'Rohit Verma',
    customerGstin: '29ABCDE1234F1Z5',
    currency: 'INR',
    taxableAmount: 288.0,
    cgstAmount: 18.75,
    sgstAmount: 18.75,
    totalTax: 37.5,
    grandTotal: 345.5,
    createdAt: 'Today, 5:45 PM',
    items: [
      {
        hsn: '34011110',
        description: 'Dettol Original Bathing Soap (75g)',
        qty: 2,
        rate: 38.0,
        cgstRate: 9,
        sgstRate: 9,
        amount: 76.0,
      },
      {
        hsn: '34022010',
        description: 'Surf Excel Detergent Bar (200g)',
        qty: 1,
        rate: 30.0,
        cgstRate: 9,
        sgstRate: 9,
        amount: 30.0,
      },
      {
        hsn: '11010000',
        description: 'Aashirvaad Whole Wheat Atta (5kg)',
        qty: 1,
        rate: 259.0,
        cgstRate: 2.5,
        sgstRate: 2.5,
        amount: 259.0,
      },
    ],
  },
];

// ==========================================
// 3. MAIN COMPONENT: SELLER HUB
// ==========================================

export const App: React.FC = () => {
  // Navigation tabs matching the user's reference image
  const [activeNav, setActiveNav] = useState<
    | 'dashboard'
    | 'listings'
    | 'inventory'
    | 'orders'
    | 'promotions'
    | 'reviews'
    | 'fulfillment'
    | 'returns'
    | 'finance'
    | 'analytics'
    | 'storesetup'
    | 'settings'
  >('inventory');

  // Core state
  const [variants, setVariants] = useState<ProductVariant[]>(INITIAL_VARIANTS);
  const [orders, setOrders] = useState<OrderRecord[]>(INITIAL_ORDERS);
  const [pickTasks, setPickTasks] = useState<PickListTask[]>(INITIAL_PICK_TASKS);
  const [invoices] = useState<InvoiceRecord[]>(INITIAL_INVOICES);

  // Inventory search & stock status filter
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'>('ALL');

  // Card quantity input state (per SKU, default 10)
  const [cardQuantities, setCardQuantities] = useState<Record<string, number>>({});

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Add Product modal state (Category, Storage, Veg, Pricing, Variants)
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [formCategoryId, setFormCategoryId] = useState(MASTER_CATEGORIES[0].id);
  const [formProductName, setFormProductName] = useState('');
  const [formBrand, setFormBrand] = useState('Dettol');
  const [formStorageType, setFormStorageType] = useState('ambient');
  const [formShelfLifeDays, setFormShelfLifeDays] = useState(180);
  const [formIsVeg, setFormIsVeg] = useState(true);
  const [formVariantName, setFormVariantName] = useState('100g Bar');
  const [formSku, setFormSku] = useState('');
  const [formBarcode, setFormBarcode] = useState('');
  const [formMrp, setFormMrp] = useState(50.0);
  const [formPrice, setFormPrice] = useState(45.0);
  const [formInitialStock, setFormInitialStock] = useState(25);
  const [formHsn, setFormHsn] = useState('34011110');
  const [formZone, setFormZone] = useState('Zone A-01-R1');
  const [formImageUrl, setFormImageUrl] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Helper: Get input quantity for a specific SKU (default to 10)
  const getCardQty = (sku: string) => {
    return cardQuantities[sku] !== undefined ? cardQuantities[sku] : 10;
  };

  const handleCardQtyChange = (sku: string, val: number) => {
    setCardQuantities((prev) => ({
      ...prev,
      [sku]: Math.max(1, isNaN(val) ? 1 : val),
    }));
  };

  // Adjust stock via "+ Add" or "– Remove"
  const handleStockAdjustment = async (sku: string, delta: number) => {
    const current = variants.find((v) => v.sku === sku);
    if (!current) return;

    const available = current.stock - current.reserved;
    if (delta < 0 && available + delta < 0) {
      showToast(`Cannot remove ${Math.abs(delta)} units. Only ${available} units available to remove.`);
      return;
    }

    const newStock = Math.max(current.reserved, current.stock + delta);

    // Call live inventory API
    await fetch('/api/v1/inventory/adjust', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'STORE_ADMIN',
        'x-user-id': 'store-staff-1',
      },
      body: JSON.stringify({
        sku,
        delta,
        reason: delta > 0 ? 'RESTOCK_RECEIVED' : 'MANUAL_COUNT_ADJUSTMENT',
        locationZone: current.zone,
      }),
    }).catch(() => null);

    setVariants((prev) =>
      prev.map((v) => (v.sku === sku ? { ...v, stock: newStock } : v))
    );

    const newAvail = newStock - current.reserved;
    if (delta > 0) {
      showToast(`Added ${delta} units to ${current.productName} (${newAvail} available now)`);
    } else {
      showToast(`Removed ${Math.abs(delta)} units from ${current.productName} (${newAvail} available now)`);
    }
  };

  // Submit Handler for Add Product Modal
  const handleCreateProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formProductName || !formSku) return;

    const selectedCat = MASTER_CATEGORIES.find((c) => c.id === formCategoryId);

    const newVariant: ProductVariant = {
      sku: formSku.toUpperCase().trim(),
      productName: formProductName.trim(),
      brand: formBrand,
      categoryId: formCategoryId,
      categoryName: selectedCat?.name || 'General Grocery',
      packSize: formVariantName,
      mrp: Number(formMrp),
      price: Number(formPrice),
      stock: Number(formInitialStock),
      reserved: 0,
      zone: formZone,
      imageUrl:
        formImageUrl.trim() ||
        selectedCat?.defaultImage ||
        'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=300&auto=format&fit=crop&q=80',
      storageType: formStorageType,
      shelfLifeDays: Number(formShelfLifeDays),
      isVeg: formIsVeg,
      hsnCode: formHsn,
      barcode: formBarcode,
    };

    // Save to backend catalog
    await fetch('/api/v1/catalog/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'STORE_ADMIN',
      },
      body: JSON.stringify({
        productName: formProductName,
        brandName: formBrand,
        primaryCategoryId: formCategoryId,
        storageType: formStorageType,
        shelfLifeDays: formShelfLifeDays,
        isVeg: formIsVeg,
        variantName: formVariantName,
        sku: formSku,
        barcode: formBarcode,
        mrp: formMrp,
        sellingPrice: formPrice,
        initialStock: formInitialStock,
        shelfZone: formZone,
        imageUrl: newVariant.imageUrl,
      }),
    }).catch(() => null);

    setVariants((prev) => [newVariant, ...prev]);
    setIsAddProductOpen(false);
    showToast(`Added "${formProductName}" to ${selectedCat?.name}!`);

    // Reset fields
    setFormProductName('');
    setFormSku('');
    setFormBarcode('');
    setFormImageUrl('');
  };

  // Update order status
  const handleUpdateOrderStatus = (orderId: string, nextStatus: OrderRecord['status']) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o))
    );
    showToast(`Order status updated to ${nextStatus.replace('_', ' ')}`);
  };

  // Filtered variants for Inventory Grid
  const filteredVariants = variants.filter((v) => {
    const available = v.stock - v.reserved;
    const matchesSearch =
      v.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.sku.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (stockFilter === 'IN_STOCK') return available > 5;
    if (stockFilter === 'LOW_STOCK') return available > 0 && available <= 5;
    if (stockFilter === 'OUT_OF_STOCK') return available === 0;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col font-sans antialiased text-gray-800 text-xs">
      {/* ========================================================= */}
      {/* TOP HEADER: Seller Hub & View Storefront */}
      {/* ========================================================= */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <span className="text-base font-bold text-gray-900 tracking-tight">Seller hub</span>
        </div>

        <a
          href="http://localhost:5173"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#047857] hover:bg-[#065f46] text-white font-medium text-xs transition-colors shadow-xs"
        >
          <span>View storefront</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </header>

      {/* ========================================================= */}
      {/* TWO COLUMN LAYOUT: SIDEBAR + MAIN AREA */}
      {/* ========================================================= */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT SIDEBAR (Matching reference image) */}
        <aside className="w-52 bg-white border-r border-gray-200 flex flex-col shrink-0 py-3">
          <nav className="space-y-0.5 px-2">
            <button
              onClick={() => setActiveNav('dashboard')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-xs font-medium transition-colors ${
                activeNav === 'dashboard'
                  ? 'bg-gray-100 text-gray-900 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 text-gray-500" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => setActiveNav('listings')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-xs font-medium transition-colors ${
                activeNav === 'listings'
                  ? 'bg-gray-100 text-gray-900 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Layers className="w-4 h-4 text-gray-500" />
              <span>Listings</span>
            </button>

            <button
              onClick={() => setActiveNav('inventory')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-xs font-medium transition-colors ${
                activeNav === 'inventory'
                  ? 'bg-gray-100 text-gray-900 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Boxes className="w-4 h-4 text-gray-500" />
              <span>Inventory</span>
            </button>

            <button
              onClick={() => setActiveNav('orders')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs font-medium transition-colors ${
                activeNav === 'orders'
                  ? 'bg-gray-100 text-gray-900 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <ShoppingCart className="w-4 h-4 text-gray-500" />
                <span>Orders</span>
              </div>
              {orders.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-gray-200 text-gray-700">
                  {orders.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveNav('promotions')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-xs font-medium transition-colors ${
                activeNav === 'promotions'
                  ? 'bg-gray-100 text-gray-900 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Tag className="w-4 h-4 text-gray-500" />
              <span>Promotions</span>
            </button>

            <button
              onClick={() => setActiveNav('reviews')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-xs font-medium transition-colors ${
                activeNav === 'reviews'
                  ? 'bg-gray-100 text-gray-900 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Star className="w-4 h-4 text-gray-500" />
              <span>Reviews</span>
            </button>

            <button
              onClick={() => setActiveNav('fulfillment')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-xs font-medium transition-colors ${
                activeNav === 'fulfillment'
                  ? 'bg-gray-100 text-gray-900 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Truck className="w-4 h-4 text-gray-500" />
              <span>Fulfillment</span>
            </button>

            <button
              onClick={() => setActiveNav('returns')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-xs font-medium transition-colors ${
                activeNav === 'returns'
                  ? 'bg-gray-100 text-gray-900 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <RotateCcw className="w-4 h-4 text-gray-500" />
              <span>Returns</span>
            </button>

            <button
              onClick={() => setActiveNav('finance')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-xs font-medium transition-colors ${
                activeNav === 'finance'
                  ? 'bg-gray-100 text-gray-900 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Receipt className="w-4 h-4 text-gray-500" />
              <span>Finance</span>
            </button>

            <button
              onClick={() => setActiveNav('analytics')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-xs font-medium transition-colors ${
                activeNav === 'analytics'
                  ? 'bg-gray-100 text-gray-900 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <TrendingUp className="w-4 h-4 text-gray-500" />
              <span>Analytics</span>
            </button>

            <button
              onClick={() => setActiveNav('storesetup')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-xs font-medium transition-colors ${
                activeNav === 'storesetup'
                  ? 'bg-gray-100 text-gray-900 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Store className="w-4 h-4 text-gray-500" />
              <span>Store setup</span>
            </button>

            <button
              onClick={() => setActiveNav('settings')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-xs font-medium transition-colors ${
                activeNav === 'settings'
                  ? 'bg-gray-100 text-gray-900 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Settings className="w-4 h-4 text-gray-500" />
              <span>Settings</span>
            </button>
          </nav>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 p-6 overflow-y-auto">
          {/* ========================================================= */}
          {/* TAB: INVENTORY (Exact Match to User's Reference Image) */}
          {/* ========================================================= */}
          {activeNav === 'inventory' && (
            <div className="space-y-6 max-w-7xl mx-auto">
              {/* Header: Title and subtitle */}
              <div>
                <h1 className="text-xl font-bold text-gray-900 tracking-tight">
                  Inventory ({variants.length})
                </h1>
                <p className="text-gray-500 text-xs mt-0.5">
                  On-hand, reserved, and available stock per product.
                </p>
              </div>

              {/* Filter bar: Search input + Stock status pills */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[260px] max-w-md">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by product, brand, or SKU"
                    className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-xs placeholder-gray-400 focus:outline-none focus:border-emerald-600 transition-colors shadow-2xs"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setStockFilter('ALL')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      stockFilter === 'ALL'
                        ? 'bg-[#047857] text-white shadow-2xs'
                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    All
                  </button>

                  <button
                    onClick={() => setStockFilter('IN_STOCK')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      stockFilter === 'IN_STOCK'
                        ? 'bg-[#047857] text-white shadow-2xs'
                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    In stock
                  </button>

                  <button
                    onClick={() => setStockFilter('LOW_STOCK')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      stockFilter === 'LOW_STOCK'
                        ? 'bg-[#047857] text-white shadow-2xs'
                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Low stock
                  </button>

                  <button
                    onClick={() => setStockFilter('OUT_OF_STOCK')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      stockFilter === 'OUT_OF_STOCK'
                        ? 'bg-[#047857] text-white shadow-2xs'
                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Out of stock
                  </button>
                </div>
              </div>

              {/* 3-Column Grid of Inventory Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredVariants.map((item) => {
                  const available = Math.max(0, item.stock - item.reserved);
                  const currentQty = getCardQty(item.sku);

                  return (
                    <div
                      key={item.sku}
                      className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col justify-between hover:border-gray-300 transition-all shadow-2xs"
                    >
                      {/* Top: Image, Name, SKU, and Status Badge */}
                      <div className="flex items-start gap-3">
                        <div className="w-14 h-14 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                          <img
                            src={item.imageUrl}
                            alt={item.productName}
                            className="w-full h-full object-contain p-1"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=100&auto=format&fit=crop&q=80';
                            }}
                          />
                        </div>

                        <div className="flex-1 min-w-0 pr-1">
                          <h3 className="font-semibold text-gray-900 text-xs sm:text-sm line-clamp-1 leading-snug">
                            {item.productName}
                          </h3>
                          <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                            {item.sku}
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0">
                          {available > 5 ? (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                              In stock
                            </span>
                          ) : available > 0 ? (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-100">
                              Low · {available}
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-50 text-rose-700 border border-rose-100">
                              Out of stock
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Middle: Units Available & On-hand / Reserved Breakdown */}
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="text-sm font-bold text-gray-900">
                          {available} units available
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5 font-normal">
                          {item.stock} on hand · {item.reserved} reserved
                        </div>
                      </div>

                      {/* Bottom Action Controls: [ 10 ] [ + Add ] [ - Remove ] */}
                      <div className="mt-3 pt-2.5 flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          value={currentQty}
                          onChange={(e) => handleCardQtyChange(item.sku, parseInt(e.target.value, 10))}
                          className="w-14 border border-gray-200 rounded-lg px-2 py-1 text-center text-xs text-gray-800 font-medium focus:outline-none focus:border-emerald-600 bg-gray-50/50"
                        />

                        <button
                          onClick={() => handleStockAdjustment(item.sku, currentQty)}
                          className="flex items-center gap-1 px-3 py-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg transition-colors shadow-2xs"
                        >
                          <Plus className="w-3 h-3 text-gray-500" />
                          <span>Add</span>
                        </button>

                        <button
                          onClick={() => handleStockAdjustment(item.sku, -currentQty)}
                          disabled={available <= 0}
                          className={`flex items-center gap-1 px-3 py-1 bg-white border border-gray-200 text-xs font-medium rounded-lg transition-colors shadow-2xs ${
                            available <= 0
                              ? 'opacity-40 cursor-not-allowed text-gray-400'
                              : 'hover:bg-gray-50 text-gray-700'
                          }`}
                        >
                          <Minus className="w-3 h-3 text-gray-500" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredVariants.length === 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-500">
                  <Boxes className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                  <p className="font-semibold text-gray-700 text-sm">No inventory items found</p>
                  <p className="text-xs text-gray-400 mt-1">Try adjusting your search query or filter</p>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB: LISTINGS (Catalog & Product Management) */}
          {/* ========================================================= */}
          {activeNav === 'listings' && (
            <div className="space-y-5 max-w-7xl mx-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-gray-900 tracking-tight">Product Listings</h1>
                  <p className="text-gray-500 text-xs mt-0.5">
                    Manage store catalog, prices, and product categories.
                  </p>
                </div>

                <button
                  onClick={() => setIsAddProductOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#047857] hover:bg-[#065f46] text-white font-medium text-xs transition-colors shadow-xs"
                >
                  <PackagePlus className="w-4 h-4" />
                  <span>+ Add Product</span>
                </button>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-500 border-b border-gray-200 font-medium">
                    <tr>
                      <th className="py-3 px-4">Product</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Pack Size</th>
                      <th className="py-3 px-4">MRP / Price</th>
                      <th className="py-3 px-4">Stock Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {variants.map((p) => {
                      const available = Math.max(0, p.stock - p.reserved);
                      return (
                        <tr key={p.sku} className="hover:bg-gray-50/60 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={p.imageUrl}
                                alt={p.productName}
                                className="w-9 h-9 rounded object-contain bg-gray-50 border border-gray-100 p-0.5"
                              />
                              <div>
                                <div className="font-semibold text-gray-900">{p.productName}</div>
                                <div className="text-[11px] text-gray-400 font-mono">{p.sku}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-600 font-medium">{p.categoryName}</td>
                          <td className="py-3 px-4 text-gray-500">{p.packSize}</td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-gray-900">₹{p.price.toFixed(2)}</div>
                            <div className="text-[10px] text-gray-400 line-through">₹{p.mrp.toFixed(2)}</div>
                          </td>
                          <td className="py-3 px-4">
                            {available > 5 ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                                In stock ({available})
                              </span>
                            ) : available > 0 ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-100">
                                Low ({available})
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-50 text-rose-700 border border-rose-100">
                                Out of stock
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => {
                                setActiveNav('inventory');
                                setSearchQuery(p.sku);
                              }}
                              className="text-emerald-700 hover:text-emerald-800 font-medium text-xs"
                            >
                              Manage Stock →
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB: ORDERS */}
          {/* ========================================================= */}
          {activeNav === 'orders' && (
            <div className="space-y-5 max-w-7xl mx-auto">
              <div>
                <h1 className="text-xl font-bold text-gray-900 tracking-tight">Customer Orders</h1>
                <p className="text-gray-500 text-xs mt-0.5">
                  Track and fulfill customer orders from Web and WhatsApp.
                </p>
              </div>

              <div className="space-y-3">
                {orders.map((ord) => (
                  <div key={ord.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-2xs">
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-sm text-gray-900">{ord.orderNumber}</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                          {ord.channel}
                        </span>
                        <span className="text-gray-400 text-[11px]">{ord.createdAt}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${
                            ord.status === 'DELIVERED'
                              ? 'bg-emerald-50 text-emerald-700'
                              : ord.status === 'PACKED' || ord.status === 'OUT_FOR_DELIVERY'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-amber-50 text-amber-800'
                          }`}
                        >
                          {ord.status.replace('_', ' ')}
                        </span>

                        {ord.status === 'CONFIRMED' && (
                          <button
                            onClick={() => handleUpdateOrderStatus(ord.id, 'PACKED')}
                            className="px-2.5 py-1 rounded-lg bg-[#047857] text-white font-medium text-xs hover:bg-[#065f46] transition-colors"
                          >
                            Mark Packed
                          </button>
                        )}
                        {ord.status === 'PACKED' && (
                          <button
                            onClick={() => handleUpdateOrderStatus(ord.id, 'OUT_FOR_DELIVERY')}
                            className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-medium text-xs hover:bg-blue-700 transition-colors"
                          >
                            Dispatch
                          </button>
                        )}
                        {ord.status === 'OUT_FOR_DELIVERY' && (
                          <button
                            onClick={() => handleUpdateOrderStatus(ord.id, 'DELIVERED')}
                            className="px-2.5 py-1 rounded-lg bg-emerald-700 text-white font-medium text-xs hover:bg-emerald-800 transition-colors"
                          >
                            Mark Delivered
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="font-semibold text-gray-800 text-xs">{ord.customerName}</div>
                        <div className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-gray-400" />
                          <span>{ord.customerPhone}</span>
                        </div>
                      </div>

                      <div className="flex-1 max-w-md">
                        <div className="text-[11px] font-medium text-gray-500 mb-1">Items:</div>
                        <div className="space-y-1">
                          {ord.items.map((it, i) => (
                            <div key={i} className="flex justify-between text-xs text-gray-700">
                              <span>
                                {it.quantity}× {it.productName} ({it.variantName})
                              </span>
                              <span className="font-medium text-gray-900">
                                ₹{(it.unitPrice * it.quantity).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[11px] text-gray-400">Total Amount</div>
                        <div className="text-base font-bold text-gray-900">₹{ord.grandTotal.toFixed(2)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB: DASHBOARD */}
          {/* ========================================================= */}
          {activeNav === 'dashboard' && (
            <div className="space-y-6 max-w-7xl mx-auto">
              <div>
                <h1 className="text-xl font-bold text-gray-900 tracking-tight">Store Dashboard</h1>
                <p className="text-gray-500 text-xs mt-0.5">Today's quick store performance metrics.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-2xs">
                  <div className="text-xs font-medium text-gray-500">Today's Revenue</div>
                  <div className="text-2xl font-bold text-gray-900 mt-1">₹680.30</div>
                  <div className="text-[11px] text-emerald-600 mt-1">2 orders placed</div>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-2xs">
                  <div className="text-xs font-medium text-gray-500">Orders in Fulfillment</div>
                  <div className="text-2xl font-bold text-gray-900 mt-1">1</div>
                  <div className="text-[11px] text-blue-600 mt-1">1 ready for dispatch</div>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-2xs">
                  <div className="text-xs font-medium text-gray-500">Total Products</div>
                  <div className="text-2xl font-bold text-gray-900 mt-1">{variants.length}</div>
                  <div className="text-[11px] text-gray-400 mt-1">Across 5 grocery categories</div>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-2xs">
                  <div className="text-xs font-medium text-gray-500">Low Stock Items</div>
                  <div className="text-2xl font-bold text-amber-700 mt-1">
                    {variants.filter((v) => v.stock - v.reserved <= 5 && v.stock - v.reserved > 0).length}
                  </div>
                  <div className="text-[11px] text-amber-700 mt-1">Require re-order soon</div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-2xs">
                <h2 className="font-semibold text-sm text-gray-900 mb-3">Quick Actions</h2>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => setActiveNav('inventory')}
                    className="px-3.5 py-2 rounded-lg bg-[#047857] text-white font-medium text-xs hover:bg-[#065f46] transition-colors"
                  >
                    Manage Inventory
                  </button>
                  <button
                    onClick={() => setIsAddProductOpen(true)}
                    className="px-3.5 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium text-xs transition-colors"
                  >
                    + Add New Product
                  </button>
                  <button
                    onClick={() => setActiveNav('orders')}
                    className="px-3.5 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium text-xs transition-colors"
                  >
                    View Pending Orders
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB: FULFILLMENT */}
          {/* ========================================================= */}
          {activeNav === 'fulfillment' && (
            <div className="space-y-5 max-w-7xl mx-auto">
              <div>
                <h1 className="text-xl font-bold text-gray-900 tracking-tight">Order Fulfillment & Packing</h1>
                <p className="text-gray-500 text-xs mt-0.5">Item pick lists organized by store aisle.</p>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-500 border-b border-gray-200 font-medium">
                    <tr>
                      <th className="py-3 px-4">Order #</th>
                      <th className="py-3 px-4">Item to Pick</th>
                      <th className="py-3 px-4">Location Zone</th>
                      <th className="py-3 px-4">Qty</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pickTasks.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="py-3 px-4 font-semibold text-gray-900">{t.orderNumber}</td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-gray-800">{t.productName}</div>
                          <div className="text-[11px] text-gray-400 font-mono">{t.sku}</div>
                        </td>
                        <td className="py-3 px-4 text-gray-600 font-medium">{t.zone}</td>
                        <td className="py-3 px-4 font-bold text-gray-900">{t.quantity}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              t.status === 'PICKED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                : 'bg-amber-50 text-amber-700 border border-amber-100'
                            }`}
                          >
                            {t.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB: FINANCE & GST */}
          {/* ========================================================= */}
          {activeNav === 'finance' && (
            <div className="space-y-5 max-w-7xl mx-auto">
              <div>
                <h1 className="text-xl font-bold text-gray-900 tracking-tight">Finance & Tax Invoices</h1>
                <p className="text-gray-500 text-xs mt-0.5">GST tax invoices and customer billings.</p>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-500 border-b border-gray-200 font-medium">
                    <tr>
                      <th className="py-3 px-4">Invoice #</th>
                      <th className="py-3 px-4">Order #</th>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4">Taxable Amount</th>
                      <th className="py-3 px-4">GST (CGST + SGST)</th>
                      <th className="py-3 px-4">Grand Total</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {invoices.map((inv) => (
                      <tr key={inv.invoiceId} className="hover:bg-gray-50/60 transition-colors">
                        <td className="py-3 px-4 font-semibold text-gray-900">{inv.invoiceNumber}</td>
                        <td className="py-3 px-4 text-gray-600">{inv.orderNumber}</td>
                        <td className="py-3 px-4 text-gray-800">{inv.customerName}</td>
                        <td className="py-3 px-4 text-gray-800">₹{inv.taxableAmount.toFixed(2)}</td>
                        <td className="py-3 px-4 text-emerald-700 font-medium">₹{inv.totalTax.toFixed(2)}</td>
                        <td className="py-3 px-4 font-bold text-gray-900">₹{inv.grandTotal.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => window.print()}
                            className="px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium inline-flex items-center gap-1"
                          >
                            <Printer className="w-3 h-3" />
                            <span>Print</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB: OTHER SECTIONS (Promotions, Reviews, Returns, Setup, Settings) */}
          {/* ========================================================= */}
          {(activeNav === 'promotions' ||
            activeNav === 'reviews' ||
            activeNav === 'returns' ||
            activeNav === 'analytics' ||
            activeNav === 'storesetup' ||
            activeNav === 'settings') && (
            <div className="space-y-5 max-w-7xl mx-auto">
              <div>
                <h1 className="text-xl font-bold text-gray-900 tracking-tight capitalize">
                  {activeNav === 'storesetup' ? 'Store Setup & Location' : activeNav}
                </h1>
                <p className="text-gray-500 text-xs mt-0.5">
                  Configure store settings, operating hours, and customer policies.
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-2xs space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                    FC
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-900 text-sm">FreshCart Store #02 - HSR Layout</h2>
                    <p className="text-gray-500 text-xs">Sector 2, 27th Main Road, HSR Layout, Bangalore - 560102</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-100">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-[11px] text-gray-400 font-medium">Operating Hours</div>
                    <div className="font-semibold text-gray-800 text-xs mt-0.5">6:00 AM – 11:30 PM (Daily)</div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-[11px] text-gray-400 font-medium">Delivery Radius</div>
                    <div className="font-semibold text-gray-800 text-xs mt-0.5">Within 5.5 km (15-30 mins delivery)</div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-[11px] text-gray-400 font-medium">WhatsApp Customer Channel</div>
                    <div className="font-semibold text-emerald-700 text-xs mt-0.5">+91 98765 43210 (Active)</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ========================================================= */}
      {/* MODAL: ADD PRODUCT TO CATEGORY (Conforming to Schema 001) */}
      {/* ========================================================= */}
      {isAddProductOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h2 className="font-bold text-base text-gray-900">Add New Product to Store</h2>
                <p className="text-gray-500 text-xs">Create product with variants, pricing, and category.</p>
              </div>
              <button
                onClick={() => setIsAddProductOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProductSubmit} className="p-6 space-y-5">
              {/* Category Selection */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Select Category</label>
                <select
                  value={formCategoryId}
                  onChange={(e) => {
                    const catId = e.target.value;
                    setFormCategoryId(catId);
                    const cat = MASTER_CATEGORIES.find((c) => c.id === catId);
                    if (cat) {
                      setFormHsn(cat.defaultHsn);
                      setFormZone(cat.defaultZone);
                      setFormBrand(cat.sampleBrands[0] || 'Brand');
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white text-gray-800 font-medium focus:outline-none focus:border-emerald-600"
                >
                  {MASTER_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.parentName})
                    </option>
                  ))}
                </select>
              </div>

              {/* Product Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Product Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dettol Original Germ Protection Bathing Soap"
                    value={formProductName}
                    onChange={(e) => setFormProductName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Brand Name</label>
                  <input
                    type="text"
                    required
                    value={formBrand}
                    onChange={(e) => setFormBrand(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              {/* Storage & Shelf Life */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Storage Condition</label>
                  <select
                    value={formStorageType}
                    onChange={(e) => setFormStorageType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white"
                  >
                    <option value="ambient">Ambient (Room Temp)</option>
                    <option value="chilled">Chilled (Cold Storage 2-8°C)</option>
                    <option value="frozen">Frozen (-18°C)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Shelf Life (Days)</label>
                  <input
                    type="number"
                    min={1}
                    value={formShelfLifeDays}
                    onChange={(e) => setFormShelfLifeDays(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Dietary Type</label>
                  <div className="flex items-center gap-3 mt-2">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        checked={formIsVeg}
                        onChange={() => setFormIsVeg(true)}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-xs text-gray-700">Vegetarian</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        checked={!formIsVeg}
                        onChange={() => setFormIsVeg(false)}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-xs text-gray-700">Non-Veg</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Variant, SKU & Barcode */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Pack Size / Variant</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 75g Bar, 1L Tetra"
                    value={formVariantName}
                    onChange={(e) => setFormVariantName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Unique SKU Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. DETTOL-ORIG-75G"
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs uppercase font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Barcode (EAN-13)</label>
                  <input
                    type="text"
                    placeholder="e.g. 8901030010021"
                    value={formBarcode}
                    onChange={(e) => setFormBarcode(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              {/* Pricing, Initial Stock, HSN */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">MRP (₹)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={formMrp}
                    onChange={(e) => setFormMrp(parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Selling Price (₹)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={formPrice}
                    onChange={(e) => setFormPrice(parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Initial Stock</label>
                  <input
                    type="number"
                    min={0}
                    value={formInitialStock}
                    onChange={(e) => setFormInitialStock(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">HSN Code</label>
                  <input
                    type="text"
                    value={formHsn}
                    onChange={(e) => setFormHsn(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              {/* Image URL & Shelf Zone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Store Shelf Location</label>
                  <input
                    type="text"
                    value={formZone}
                    onChange={(e) => setFormZone(e.target.value)}
                    placeholder="e.g. Zone A-01-R1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Product Image URL (Optional)</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={formImageUrl}
                    onChange={(e) => setFormImageUrl(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddProductOpen(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#047857] hover:bg-[#065f46] text-white font-semibold text-xs transition-colors shadow-xs"
                >
                  Save Product to Catalog
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TOAST NOTIFICATION */}
      {/* ========================================================= */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-gray-900 text-white px-4 py-2.5 rounded-lg shadow-lg text-xs font-medium flex items-center gap-2 animate-fade-in border border-gray-700">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

export default App;
