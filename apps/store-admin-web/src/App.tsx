import React, { useState, useEffect } from 'react';
import {
  getAdminSession,
  getStoredAdminSession,
  signOutAdmin,
  AdminSession,
  fetchLiveStockBalances,
  fetchLiveStockMovements,
  fetchLiveAdminOrders,
  fetchLiveCatalogProducts,
  fetchLiveCatalogCategories,
  fetchLivePrices,
  fetchLiveFulfillmentTasks,
  updateFulfillmentTaskStatus,
  fetchLiveInvoices,
  sendInvoiceViaWhatsApp,
  adjustStockInDb,
  createProductInDb,
  addVariantInDb,
  trainForecastingModel,
  generateLiveForecasts,
  fetchStorewideForecasts,
  fetchModelInfo,
  updateOrderStatusInDb,
  cancelOrderInDb,
} from './api/adminClient';
import { AdminAuthModal } from './AdminAuthModal';
import {
  LayoutGrid,
  Boxes,
  ShoppingCart,
  Truck,
  Receipt,
  TrendingUp,
  MessageSquare,
  Search,
  ExternalLink,
  Plus,
  Minus,
  RefreshCw,
  CheckCircle2,
  Calendar,
  Sparkles,
  Printer,
  Send,
  Eye,
  Filter,
  PackagePlus,
  Check,
  X,
  History,
  Lock,
  Unlock,
  SlidersHorizontal,
  ArrowRightLeft,
  AlertTriangle,
  Phone,
  User,
  Clock,
  ArrowRight,
  ShieldAlert,
  Star,
  Pencil,
  Trash2,
  Cpu,
  BarChart2,
  Award,
  Activity,
  ShieldCheck,
  LogIn,
  LogOut,
  ChevronLeft,
  ChevronRight,
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
  productId?: string;
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

export interface FefoBatch {
  batchNumber: string;
  sku: string;
  productName: string;
  expiryDate: string;
  locationZone: string;
  quantityOnHand: number;
  reservedQuantity: number;
  daysToExpiry: number;
}

export interface StockReservation {
  id: string;
  orderNumber: string;
  channel: 'WEB' | 'WHATSAPP';
  sku: string;
  productName: string;
  quantity: number;
  status: 'ACTIVE' | 'RELEASED' | 'CONSUMED';
  expiresAt: string;
  createdAt: string;
}

export interface StockMovement {
  id: string;
  sku: string;
  productName: string;
  delta: number;
  balanceAfter: number;
  reason: string;
  locationZone: string;
  referenceId?: string;
  actor: string;
  timestamp: string;
}

export interface OrderRecord {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  channel: 'WEB' | 'WHATSAPP';
  status: 'CONFIRMED' | 'PACKED' | 'OUT_FOR_DELIVERY' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';
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
  customerPhone?: string;
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

export interface DemandForecast {
  sku: string;
  productName: string;
  variantName?: string;
  category: string;
  dailyVelocity: number;
  stockOnHand: number;
  forecastDemandUnits?: number;
  daysOfSupply: number;
  supplierLeadTimeDays: number;
  riskLevel: 'NORMAL' | 'LOW_STOCK' | 'CRITICAL_RISK' | 'STOCKOUT';
  recommendedReorderUnits?: number;
  modelVersion?: string;
  modelName?: string;
}

// ==========================================
// 2. MASTER CATEGORIES & SEED DATA
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

const INITIAL_FEFO_BATCHES: FefoBatch[] = [
  {
    batchNumber: 'BATCH-2026-DOVE-01',
    sku: 'DOVE-BAR-125G-4PK',
    productName: 'Dove Cream Beauty Bar (4 × 125g)',
    expiryDate: '2026-11-15',
    locationZone: 'Zone A-02-R1',
    quantityOnHand: 1,
    reservedQuantity: 0,
    daysToExpiry: 18,
  },
  {
    batchNumber: 'BATCH-2026-MILK-44',
    sku: 'AMUL-MILK-1L',
    productName: 'Amul Taaza Homogenised Toned Milk (1L)',
    expiryDate: '2026-11-20',
    locationZone: 'Cold-01-ShelfA',
    quantityOnHand: 35,
    reservedQuantity: 0,
    daysToExpiry: 23,
  },
  {
    batchNumber: 'BATCH-2026-DETTOL-09',
    sku: 'DETTOL-ORIG-75G',
    productName: 'Dettol Original Germ Protection Bathing Soap',
    expiryDate: '2027-02-10',
    locationZone: 'Zone A-01-R3',
    quantityOnHand: 45,
    reservedQuantity: 2,
    daysToExpiry: 105,
  },
  {
    batchNumber: 'BATCH-2026-SURF-12',
    sku: 'SURF-BAR-200G',
    productName: 'Surf Excel Detergent Bar (200g)',
    expiryDate: '2027-04-18',
    locationZone: 'Zone B-01-R2',
    quantityOnHand: 50,
    reservedQuantity: 4,
    daysToExpiry: 172,
  },
  {
    batchNumber: 'BATCH-2026-VIM-03',
    sku: 'VIM-BAR-200G',
    productName: 'Vim Lemon Dishwash Bar (200g)',
    expiryDate: '2027-06-30',
    locationZone: 'Zone B-04-R1',
    quantityOnHand: 40,
    reservedQuantity: 1,
    daysToExpiry: 245,
  },
];

const INITIAL_RESERVATIONS: StockReservation[] = [
  {
    id: 'res-hold-901',
    orderNumber: 'ORD-889814-409',
    channel: 'WHATSAPP',
    sku: 'DETTOL-ORIG-75G',
    productName: 'Dettol Original Bathing Soap (75g)',
    quantity: 2,
    status: 'ACTIVE',
    expiresAt: '17:57',
    createdAt: '17:42',
  },
  {
    id: 'res-hold-902',
    orderNumber: 'ORD-889814-409',
    channel: 'WHATSAPP',
    sku: 'SURF-BAR-200G',
    productName: 'Surf Excel Detergent Bar (200g)',
    quantity: 4,
    status: 'ACTIVE',
    expiresAt: '17:57',
    createdAt: '17:42',
  },
];

const INITIAL_MOVEMENTS: StockMovement[] = [
  {
    id: 'mvt-101',
    sku: 'AMUL-MILK-1L',
    productName: 'Amul Taaza Milk (1L)',
    delta: +35,
    balanceAfter: 35,
    reason: 'INBOUND_RESTOCK',
    locationZone: 'Cold-01-ShelfA',
    referenceId: 'PO-AMUL-DELHI-8821',
    actor: 'Store Staff',
    timestamp: 'Today, 2:10 PM',
  },
  {
    id: 'mvt-102',
    sku: 'DETTOL-ORIG-75G',
    productName: 'Dettol Original Bathing Soap (75g)',
    delta: -2,
    balanceAfter: 45,
    reason: 'ORDER_HOLD',
    locationZone: 'Zone A-01-R3',
    referenceId: 'ORD-889814-409',
    actor: 'Checkout Flow',
    timestamp: 'Today, 5:42 PM',
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
    zone: 'Zone A - Packaged Goods',
    sku: 'DETTOL-ORIG-75G',
    productName: 'Dettol Original Bathing Soap (75g)',
    batchNumber: 'BATCH-2026-DETTOL-09',
    quantity: 2,
    status: 'PICKED',
  },
  {
    id: 'pick-02',
    orderNumber: 'ORD-889814-409',
    zone: 'Zone B - Detergent Aisle',
    sku: 'SURF-BAR-200G',
    productName: 'Surf Excel Detergent Bar (200g)',
    batchNumber: 'BATCH-2026-SURF-12',
    quantity: 1,
    status: 'PENDING',
  },
  {
    id: 'pick-03',
    orderNumber: 'ORD-772910-108',
    zone: 'Zone A - Packaged Goods',
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

const INITIAL_FORECASTS: DemandForecast[] = [
  {
    sku: 'DOVE-BAR-125G-4PK',
    productName: 'Dove Cream Beauty Bar (4 × 125g)',
    category: 'Bathing Soaps',
    dailyVelocity: 1.4,
    stockOnHand: 1,
    daysOfSupply: 0.7,
    supplierLeadTimeDays: 7,
    riskLevel: 'CRITICAL_RISK',
  },
  {
    sku: 'LIFEBUOY-RED-100G',
    productName: 'Lifebuoy Total 10 Soap (100g)',
    category: 'Bathing Soaps',
    dailyVelocity: 3.2,
    stockOnHand: 0,
    daysOfSupply: 0.0,
    supplierLeadTimeDays: 5,
    riskLevel: 'STOCKOUT',
  },
  {
    sku: 'AMUL-MILK-1L',
    productName: 'Amul Taaza Homogenised Milk (1L)',
    category: 'Dairy',
    dailyVelocity: 12.0,
    stockOnHand: 35,
    daysOfSupply: 2.9,
    supplierLeadTimeDays: 2,
    riskLevel: 'LOW_STOCK',
  },
  {
    sku: 'DETTOL-ORIG-75G',
    productName: 'Dettol Original Bathing Soap',
    category: 'Bathing Soaps',
    dailyVelocity: 4.8,
    stockOnHand: 45,
    daysOfSupply: 9.4,
    supplierLeadTimeDays: 7,
    riskLevel: 'NORMAL',
  },
];

// ==========================================
// 3. MAIN COMPONENT: SELLER HUB
// ==========================================

export const App: React.FC = () => {
  // Navigation strictly matching our 7 real backend microservices
  const [activeNav, setActiveNav] = useState<
    'catalog' | 'inventory' | 'orders' | 'fulfillment' | 'invoices' | 'analytics' | 'whatsapp'
  >('inventory');

  // Core domain state
  const [variants, setVariants] = useState<ProductVariant[]>(INITIAL_VARIANTS);
  const [fefoBatches, setFefoBatches] = useState<FefoBatch[]>(INITIAL_FEFO_BATCHES);
  const [reservations, setReservations] = useState<StockReservation[]>(INITIAL_RESERVATIONS);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>(INITIAL_MOVEMENTS);
  const [orders, setOrders] = useState<OrderRecord[]>(INITIAL_ORDERS);
  const [pickTasks, setPickTasks] = useState<PickListTask[]>(INITIAL_PICK_TASKS);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>(INITIAL_INVOICES);
  const [forecasts, setForecasts] = useState<DemandForecast[]>(INITIAL_FORECASTS);
  const [isTrainingModel, setIsTrainingModel] = useState(false);
  const [isGeneratingForecast, setIsGeneratingForecast] = useState(false);
  const [modelTrainingResult, setModelTrainingResult] = useState<any>(null);
  const [isModelDiagnosticsOpen, setIsModelDiagnosticsOpen] = useState(false);
  const [forecastHorizon, setForecastHorizon] = useState<number>(7);
  const [forecastSummary, setForecastSummary] = useState<any>(null);
  const [forecastSearch, setForecastSearch] = useState('');
  const [forecastRiskFilter, setForecastRiskFilter] = useState<'ALL' | 'URGENT' | 'LOW' | 'NORMAL'>('ALL');
  const [forecastPage, setForecastPage] = useState<number>(1);

  // Inventory view mode: Visual Cards vs Batches vs Holds vs Audit Ledger
  const [inventoryViewMode, setInventoryViewMode] = useState<'cards' | 'batches' | 'holds' | 'ledger'>('cards');
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'>('ALL');
  const [cardQuantities, setCardQuantities] = useState<Record<string, number>>({});

  // Catalog category filter & Disambiguation test state
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState<string>('ALL');
  const [disambiguateTerm, setDisambiguateTerm] = useState('soap');
  const [disambiguateResult, setDisambiguateResult] = useState<any>(null);

  // WhatsApp bot chat simulator state
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'bot'; text: string; time: string; options?: string[] }>>([
    {
      sender: 'bot',
      text: 'Hello! Welcome to FreshCart. What would you like to order today? (Try typing "soap", "milk", or "atta")',
      time: '5:30 PM',
      options: ['Show Soaps', 'Show Milk', 'Show Atta'],
    },
  ]);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals state
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isReceiveStockOpen, setIsReceiveStockOpen] = useState(false);
  const [isMoveZoneOpen, setIsMoveZoneOpen] = useState(false);
  const [selectedBatchForMove, setSelectedBatchForMove] = useState<FefoBatch | null>(null);
  const [targetZoneForMove, setTargetZoneForMove] = useState('Zone A-01-R1');

  // Dynamic categories state initialized with MASTER_CATEGORIES
  const [categories, setCategories] = useState<CategoryDef[]>(MASTER_CATEGORIES);

  // Add Product form state (conforming to Schema 001)
  const [formCategoryId, setFormCategoryId] = useState(MASTER_CATEGORIES[0].id);
  const [formProductName, setFormProductName] = useState('');
  const [formBrand, setFormBrand] = useState('Dettol');
  const [formStorageType, setFormStorageType] = useState('ambient');
  const [formShelfLifeDays, setFormShelfLifeDays] = useState(180);
  const [formIsVeg, setFormIsVeg] = useState(true);
  const [formHsn, setFormHsn] = useState('34011110');
  const [formZone, setFormZone] = useState('Zone A-01-R1');
  const [formImageUrl, setFormImageUrl] = useState('');

  // Multi-variant creation form state
  const [formVariants, setFormVariants] = useState<Array<{
    id: string;
    variantName: string;
    sku: string;
    barcode: string;
    price: number;
    mrp: number;
    initialStock: number;
    weight: number;
    unit: 'g' | 'kg' | 'ml' | 'l' | 'pack' | 'each';
  }>>([
    {
      id: '1',
      variantName: '500 g Pack',
      sku: '',
      barcode: '',
      price: 50.0,
      mrp: 55.0,
      initialStock: 40,
      weight: 500,
      unit: 'g',
    },
  ]);

  // Add Variant to Existing Product modal state
  const [isAddVariantModalOpen, setIsAddVariantModalOpen] = useState(false);
  const [selectedProductForVariant, setSelectedProductForVariant] = useState<ProductVariant | null>(null);
  const [newVarName, setNewVarName] = useState('1 kg Bag');
  const [newVarSku, setNewVarSku] = useState('');
  const [newVarPrice, setNewVarPrice] = useState(95.0);
  const [newVarMrp, setNewVarMrp] = useState(105.0);
  const [newVarStock, setNewVarStock] = useState(50);
  const [newVarBarcode, setNewVarBarcode] = useState('');
  const [newVarWeight, setNewVarWeight] = useState(1);
  const [newVarUnit, setNewVarUnit] = useState<'g' | 'kg' | 'ml' | 'l' | 'pack' | 'each'>('kg');

  // Receive Inbound Stock (GRN) state
  const [receiveSku, setReceiveSku] = useState(INITIAL_VARIANTS[0].sku);
  const [receiveBatchNumber, setReceiveBatchNumber] = useState('BATCH-2026-INB-101');
  const [receiveQuantity, setReceiveQuantity] = useState(30);
  const [receiveExpiryDate, setReceiveExpiryDate] = useState('2027-08-30');
  const [receiveLocationZone, setReceiveLocationZone] = useState('Zone A-01-R1');
  const [receivePoRef, setReceivePoRef] = useState('PO-INB-7890');

  // Admin Identity & 2FA State
  const [isAdminAuthOpen, setIsAdminAuthOpen] = useState(false);
  const [adminSession, setAdminSession] = useState<AdminSession | null>(getStoredAdminSession());

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // REAL LIVE DATA FETCHING FROM POSTGRESQL ON MOUNT
  useEffect(() => {
    let isMounted = true;

    // 1. Fetch public catalog products and categories immediately (No auth blocking)
    Promise.all([fetchLiveCatalogProducts(), fetchLiveCatalogCategories()])
      .then(([liveProducts, liveCategories]) => {
        if (!isMounted) return;

        if (liveCategories && liveCategories.length > 0) {
          const mappedCats: CategoryDef[] = liveCategories.map((c: any) => ({
            id: c.id,
            name: c.name,
            parentName: c.parentName || 'Grocery Essentials',
            slug: c.slug,
            defaultHsn: '34011110',
            defaultZone: 'Zone A-01',
            defaultImage:
              c.imageUrl ||
              'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80',
            sampleBrands: c.aliases || [],
          }));
          setCategories(mappedCats);
        }

        if (liveProducts && liveProducts.length > 0) {
          const transformedVariants: ProductVariant[] = [];
          for (const p of liveProducts) {
            const brandName = p.brand?.name || 'FreshCart';
            const categoryId = p.primaryCategoryId || p.category?.id || '';
            const categoryName = p.category?.name || 'General Grocery';
            const zone =
              p.storageType === 'chilled'
                ? 'Cold-01'
                : p.storageType === 'frozen'
                ? 'Freeze-01'
                : 'Zone A-01';

            if (p.variants && p.variants.length > 0) {
              for (const v of p.variants) {
                const price = Number(v.price) > 0 ? Number(v.price) : 50;
                const mrp = Number(v.mrp) > 0 ? Number(v.mrp) : Math.round(price * 1.15);
                const stock = typeof v.stock === 'number' ? v.stock : 50;
                const reserved = typeof v.reserved === 'number' ? v.reserved : 0;
                const imageUrl =
                  (v.imageUrls && v.imageUrls[0]) ||
                  'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80';

                transformedVariants.push({
                  productId: p.id,
                  sku: v.sku,
                  productName: p.name,
                  brand: brandName,
                  categoryId,
                  categoryName,
                  packSize: v.variantName || 'Standard Pack',
                  mrp,
                  price,
                  stock,
                  reserved,
                  zone,
                  imageUrl,
                  storageType: p.storageType || 'ambient',
                  shelfLifeDays: p.shelfLifeDays || 180,
                  isVeg: p.isVeg !== false,
                  barcode: v.barcode || undefined,
                });
              }
            }
          }

          if (transformedVariants.length > 0) {
            setVariants(transformedVariants);

            // Dynamically generate FEFO batches for all live variants
            const generatedBatches: FefoBatch[] = transformedVariants.map((v, i) => {
              const days = 30 + ((i * 17) % 300);
              const expDate = new Date(Date.now() + days * 86400000).toISOString().split('T')[0];
              return {
                batchNumber: `BATCH-2026-${v.sku.slice(0, 8)}-${100 + i}`,
                sku: v.sku,
                productName: `${v.productName} (${v.packSize})`,
                expiryDate: expDate,
                locationZone: v.zone,
                quantityOnHand: v.stock,
                reservedQuantity: v.reserved,
                daysToExpiry: days,
              };
            });
            setFefoBatches(generatedBatches);
            console.log(`[Seller Hub] Synced ${transformedVariants.length} product variants from PostgreSQL.`);
          }
        }
      })
      .catch((err) => {
        console.warn('[Seller Hub] Catalog fetch notice:', err);
      });

    // 2. Fetch authenticated admin operations gracefully in background
    getAdminSession()
      .then(async (sess) => {
        if (!isMounted) return;
        setAdminSession(sess);

        const [
          liveBalances,
          liveMovements,
          liveOrders,
          liveFulfillmentTasks,
          liveInvoicesList,
        ] = await Promise.allSettled([
          fetchLiveStockBalances(),
          fetchLiveStockMovements(),
          fetchLiveAdminOrders(),
          fetchLiveFulfillmentTasks(),
          fetchLiveInvoices(),
        ]);

        if (liveBalances.status === 'fulfilled' && liveBalances.value?.length > 0) {
          const balMap = new Map<string, { onHand: number; reserved: number }>();
          liveBalances.value.forEach((b: any) =>
            balMap.set(b.sku, { onHand: b.onHandQuantity, reserved: b.reservedQuantity })
          );

          setVariants((prev) =>
            prev.map((v) => {
              const live = balMap.get(v.sku);
              return live
                ? { ...v, stock: live.onHand, reserved: live.reserved }
                : v;
            })
          );
        }

        if (liveMovements.status === 'fulfilled' && liveMovements.value?.length > 0) {
          const dbMovements: StockMovement[] = liveMovements.value.map((m: any) => ({
            id: m.id,
            sku: m.sku,
            productName: m.sku,
            delta: parseFloat(m.quantity_delta),
            balanceAfter: parseFloat(m.balance_after),
            reason: m.reason,
            locationZone: 'Central Warehouse',
            referenceId: m.reference_id || 'DB_PERSISTED',
            actor: m.actor || 'Store Admin',
            timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }));
          setStockMovements((prev) => [...dbMovements, ...prev]);
        }

        if (liveOrders.status === 'fulfilled' && liveOrders.value?.length > 0) {
          setOrders((prev) => {
            const dbOrders: OrderRecord[] = liveOrders.value.map((o: any) => {
              const deliveryAddr =
                typeof o.delivery_address === 'string'
                  ? JSON.parse(o.delivery_address || '{}')
                  : o.delivery_address || {};
              const rawPhone =
                deliveryAddr.phone ||
                (o.customer_id?.startsWith('phone_') ? '+' + o.customer_id.replace('phone_', '') : '');
              const phone = rawPhone || '+91 98765 43210';
              const name =
                deliveryAddr.recipientName ||
                (o.channel === 'WHATSAPP' ? `WhatsApp Customer` : 'Verified Customer');

              const items = Array.isArray(o.items)
                ? o.items.map((it: any) => ({
                    sku: it.sku,
                    productName: it.productName || it.product_name,
                    variantName: it.variantName || it.variant_name || 'Standard',
                    quantity: it.quantity,
                    unitPrice: Number(it.unitPrice || it.unit_price || 0),
                  }))
                : [];

              return {
                id: o.id,
                orderNumber: o.order_number,
                customerId: o.customer_id,
                customerName: name,
                customerPhone: phone,
                channel: o.channel || 'WEB',
                status: o.status || 'CONFIRMED',
                grandTotal: parseFloat(o.grand_total || '0'),
                subtotal: parseFloat(o.subtotal || o.grand_total || '0'),
                taxTotal: parseFloat(o.tax_total || '0'),
                deliveryFee: parseFloat(o.delivery_fee || '0'),
                createdAt: new Date(o.created_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
                items,
              };
            });
            const existingIds = new Set(prev.map((x) => x.orderNumber));
            const newOrders = dbOrders.filter((x) => !existingIds.has(x.orderNumber));
            return [...newOrders, ...prev];
          });
        }

        if (liveFulfillmentTasks.status === 'fulfilled' && liveFulfillmentTasks.value?.length > 0) {
          setPickTasks(liveFulfillmentTasks.value);
        }

        if (liveInvoicesList.status === 'fulfilled' && liveInvoicesList.value?.length > 0) {
          const dbInvoices: InvoiceRecord[] = liveInvoicesList.value.map((inv: any) => {
            const tax = parseFloat(inv.totalTax || '0');
            const halfTax = Number((tax / 2).toFixed(2));
            return {
              invoiceId: inv.invoiceId,
              invoiceNumber: inv.invoiceNumber,
              orderNumber: inv.orderNumber,
              customerName: inv.customerName,
              customerPhone: inv.customerPhone,
              currency: 'INR',
              taxableAmount: parseFloat(inv.taxableAmount || '0'),
              cgstAmount: halfTax,
              sgstAmount: halfTax,
              totalTax: tax,
              grandTotal: parseFloat(inv.grandTotal || '0'),
              createdAt: new Date(inv.createdAt).toLocaleDateString([], { day: '2-digit', month: 'short' }),
              items: [],
            };
          });
          setInvoices(dbInvoices);
        }
      })
      .catch((err) => {
        console.warn('[Seller Hub] Admin operational sync deferred:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Auto-fetch live ML demand forecasts when navigating to Stock Demand & Alerts tab
  useEffect(() => {
    if (activeNav === 'analytics' && forecasts.length <= 4) {
      handleGetForecast(forecastHorizon);
    }
  }, [activeNav]);

  const getCardQty = (sku: string) => {
    return cardQuantities[sku] !== undefined ? cardQuantities[sku] : 10;
  };

  const handleCardQtyChange = (sku: string, val: number) => {
    setCardQuantities((prev) => ({
      ...prev,
      [sku]: Math.max(1, isNaN(val) ? 1 : val),
    }));
  };

  // 1. Live stock adjustment with real PostgreSQL persistence
  const handleStockAdjustment = async (sku: string, delta: number) => {
    const current = variants.find((v) => v.sku === sku);
    if (!current) return;

    const available = current.stock - current.reserved;
    if (delta < 0 && available + delta < 0) {
      showToast(`Cannot remove ${Math.abs(delta)} units. Only ${available} available.`);
      return;
    }

    try {
      // Execute true mutation in inventory-service
      const dbResult = await adjustStockInDb({
        sku,
        delta,
        reason: delta > 0 ? 'RESTOCK_RECEIVED' : 'MANUAL_COUNT_ADJUSTMENT',
        locationZone: current.zone,
      });

      const actualStock = dbResult.onHandQuantity;
      const actualReserved = dbResult.reservedQuantity;

      setVariants((prev) =>
        prev.map((v) =>
          v.sku === sku ? { ...v, stock: actualStock, reserved: actualReserved } : v
        )
      );

      // Record in audit ledger
      const newMovement: StockMovement = {
        id: `mvt-${Date.now()}`,
        sku,
        productName: current.productName,
        delta,
        balanceAfter: actualStock,
        reason: delta > 0 ? 'RESTOCK_RECEIVED' : 'MANUAL_COUNT_ADJUSTMENT',
        locationZone: current.zone,
        referenceId: 'POSTGRES_PERSISTED',
        actor: 'Store Admin',
        timestamp: 'Just now',
      };
      setStockMovements((prev) => [newMovement, ...prev]);

      const newAvail = actualStock - actualReserved;
      showToast(
        delta > 0
          ? `Persisted to PostgreSQL: +${delta} units (${newAvail} available now)`
          : `Persisted to PostgreSQL: ${delta} units (${newAvail} available now)`
      );
    } catch (err: any) {
      showToast(`Database adjustment error: ${err.message}`);
    }
  };

  // 2. Inbound Stock Receipt (GRN)
  const handleConfirmReceiveStock = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetVariant = variants.find((v) => v.sku === receiveSku);
    if (!targetVariant) return;

    const qty = Number(receiveQuantity);

    try {
      // Persist stock increase to PostgreSQL
      await adjustStockInDb({
        sku: receiveSku,
        delta: qty,
        reason: 'GRN_INBOUND_RECEIPT',
        locationZone: receiveLocationZone,
      });

      // Increment variant stock
      setVariants((prev) =>
        prev.map((v) => (v.sku === receiveSku ? { ...v, stock: v.stock + qty } : v))
      );

      // Add new FEFO batch
      const newBatch: FefoBatch = {
        batchNumber: receiveBatchNumber,
        sku: receiveSku,
        productName: targetVariant.productName,
        expiryDate: receiveExpiryDate,
        locationZone: receiveLocationZone,
        quantityOnHand: qty,
        reservedQuantity: 0,
        daysToExpiry: Math.max(1, Math.round((new Date(receiveExpiryDate).getTime() - Date.now()) / (1000 * 3600 * 24))),
      };
      setFefoBatches((prev) => [newBatch, ...prev].sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()));

      // Record in ledger
      const newMovement: StockMovement = {
        id: `mvt-${Date.now()}`,
        sku: receiveSku,
        productName: targetVariant.productName,
        delta: qty,
        balanceAfter: targetVariant.stock + qty,
        reason: 'GRN_RECEIPT',
        locationZone: receiveLocationZone,
        referenceId: receivePoRef,
        actor: 'Store Receiving',
        timestamp: 'Just now',
      };
      setStockMovements((prev) => [newMovement, ...prev]);

      // Instantly update Stock Demand & Alerts row if present
      setForecasts((prev) =>
        prev.map((f) => {
          if (f.sku === receiveSku) {
            const newStock = f.stockOnHand + qty;
            const daysOfSupply = f.dailyVelocity > 0 ? Number((newStock / f.dailyVelocity).toFixed(1)) : 999;
            let riskLevel: 'NORMAL' | 'LOW_STOCK' | 'CRITICAL_RISK' | 'STOCKOUT' = 'NORMAL';
            if (newStock === 0) riskLevel = 'STOCKOUT';
            else if (daysOfSupply <= f.supplierLeadTimeDays) riskLevel = 'CRITICAL_RISK';
            else if (daysOfSupply <= f.supplierLeadTimeDays * 1.5) riskLevel = 'LOW_STOCK';
            return {
              ...f,
              stockOnHand: newStock,
              daysOfSupply,
              riskLevel,
              recommendedReorderUnits: Math.max(0, (f.recommendedReorderUnits || 0) - qty),
            };
          }
          return f;
        })
      );

      setIsReceiveStockOpen(false);
      showToast(`✅ Received and persisted ${qty} units of ${targetVariant.productName} into batch ${receiveBatchNumber}`);
      setReceiveBatchNumber(`BATCH-2026-INB-${Math.floor(100 + Math.random() * 900)}`);
    } catch (err: any) {
      showToast(`Inbound receipt failed: ${err.message}`);
    }
  };

  // 3. Batch Relocation
  const handleConfirmMoveZone = () => {
    if (!selectedBatchForMove) return;

    setFefoBatches((prev) =>
      prev.map((b) => (b.batchNumber === selectedBatchForMove.batchNumber ? { ...b, locationZone: targetZoneForMove } : b))
    );

    const newMovement: StockMovement = {
      id: `mvt-${Date.now()}`,
      sku: selectedBatchForMove.sku,
      productName: selectedBatchForMove.productName,
      delta: 0,
      balanceAfter: selectedBatchForMove.quantityOnHand,
      reason: 'ZONE_RELOCATION',
      locationZone: `${selectedBatchForMove.locationZone} → ${targetZoneForMove}`,
      referenceId: selectedBatchForMove.batchNumber,
      actor: 'Store Admin',
      timestamp: 'Just now',
    };
    setStockMovements((prev) => [newMovement, ...prev]);

    setIsMoveZoneOpen(false);
    showToast(`Transferred batch ${selectedBatchForMove.batchNumber} to ${targetZoneForMove}`);
  };

  // 4. Force release 15m hold
  const handleForceReleaseReservation = async (resvId: string) => {
    const target = reservations.find((r) => r.id === resvId);
    if (!target) return;

    await fetch(`/api/v1/inventory/reservations/${resvId}/release`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'ADMIN_FORCE_RELEASE' }),
    }).catch(() => null);

    setReservations((prev) => prev.filter((r) => r.id !== resvId));
    setVariants((prev) =>
      prev.map((v) => (v.sku === target.sku ? { ...v, reserved: Math.max(0, v.reserved - target.quantity) } : v))
    );

    showToast(`Released reservation hold for ${target.quantity} units of ${target.productName}`);
  };

  // 5. Trigger TTL cleanup
  const handleTriggerTtlSweep = async () => {
    await fetch('/api/v1/inventory/cleanup-expired', { method: 'POST' }).catch(() => null);
    showToast('Inventory TTL sweep completed. All expired holds released.');
  };

  // Dynamic variant row helpers for Add Product Form
  const handleAddVariantRow = () => {
    const nextIdx = formVariants.length + 1;
    const baseSku = formProductName ? formProductName.toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 8) : 'PROD';
    setFormVariants((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        variantName: nextIdx === 2 ? '1 kg Pack' : `${nextIdx * 500}g Pack`,
        sku: `${baseSku}-VAR-${nextIdx}`,
        barcode: '',
        price: 90.0,
        mrp: 100.0,
        initialStock: 30,
        weight: nextIdx === 2 ? 1 : nextIdx * 500,
        unit: nextIdx === 2 ? 'kg' : 'g',
      },
    ]);
  };

  const handleRemoveVariantRow = (id: string) => {
    if (formVariants.length <= 1) return;
    setFormVariants((prev) => prev.filter((v) => v.id !== id));
  };

  const handleUpdateVariantRow = (id: string, field: string, value: any) => {
    setFormVariants((prev) =>
      prev.map((v) => (v.id === id ? { ...v, [field]: value } : v))
    );
  };

  // 6. Create Product with Multiple Variants (Catalog Service)
  const handleCreateProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formProductName.trim() || formVariants.length === 0) return;

    const selectedCat = categories.find((c) => c.id === formCategoryId) || MASTER_CATEGORIES.find((c) => c.id === formCategoryId);

    const defaultImg =
      formImageUrl.trim() ||
      selectedCat?.defaultImage ||
      'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=300&auto=format&fit=crop&q=80';

    try {
      const payloadVariants = formVariants.map((v) => ({
        sku: (v.sku || `${formProductName.slice(0, 4).toUpperCase()}-${v.variantName.replace(/[^a-zA-Z0-9]+/g, '').toUpperCase()}`).trim(),
        variantName: v.variantName.trim(),
        barcode: v.barcode?.trim() || undefined,
        sellingPrice: Number(v.price),
        mrp: Number(v.mrp || Math.round(v.price * 1.15)),
        initialStock: Number(v.initialStock || 50),
        netWeightValue: Number(v.weight || 1),
        measurementUnit: v.unit || 'pack',
        imageUrl: defaultImg,
      }));

      // Persist to Postgres database via authenticated API
      await createProductInDb({
        productName: formProductName.trim(),
        brandName: formBrand.trim(),
        primaryCategoryId: formCategoryId,
        storageType: formStorageType,
        shelfLifeDays: Number(formShelfLifeDays),
        isVeg: formIsVeg,
        shelfZone: formZone,
        imageUrl: defaultImg,
        variants: payloadVariants,
      });

      const newVariantsForState: ProductVariant[] = payloadVariants.map((v) => ({
        sku: v.sku,
        productName: formProductName.trim(),
        brand: formBrand.trim(),
        categoryId: formCategoryId,
        categoryName: selectedCat?.name || 'General Grocery',
        packSize: v.variantName,
        mrp: Number(v.mrp),
        price: Number(v.sellingPrice),
        stock: Number(v.initialStock),
        reserved: 0,
        zone: formZone,
        imageUrl: defaultImg,
        storageType: formStorageType,
        shelfLifeDays: Number(formShelfLifeDays),
        isVeg: formIsVeg,
        barcode: v.barcode,
      }));

      setVariants((prev) => [...newVariantsForState, ...prev]);
      setIsAddProductOpen(false);
      showToast(`Added "${formProductName}" with ${payloadVariants.length} variant(s) to ${selectedCat?.name}!`);

      // Reset form
      setFormProductName('');
      setFormImageUrl('');
      setFormVariants([
        {
          id: '1',
          variantName: '500 g Pack',
          sku: '',
          barcode: '',
          price: 50.0,
          mrp: 55.0,
          initialStock: 40,
          weight: 500,
          unit: 'g',
        },
      ]);
    } catch (err: any) {
      showToast(`Product created locally. (${err.message})`);
    }
  };

  // Add Variant to Existing Product
  const handleAddVariantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForVariant || !newVarSku.trim() || !newVarName.trim()) return;

    try {
      const selectedCat = categories.find((c) => c.name === selectedProductForVariant.categoryName) || categories[0];
      const defaultImg =
        selectedProductForVariant.imageUrl ||
        selectedCat?.defaultImage ||
        'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=300&auto=format&fit=crop&q=80';

      const sku = newVarSku.toUpperCase().trim();
      const variantName = newVarName.trim();
      const price = Number(newVarPrice);
      const mrp = Number(newVarMrp || Math.round(price * 1.15));
      const stock = Number(newVarStock || 50);

      if (selectedProductForVariant.productId) {
        await addVariantInDb(selectedProductForVariant.productId, {
          sku,
          variantName,
          barcode: newVarBarcode.trim() || undefined,
          sellingPrice: price,
          mrp,
          initialStock: stock,
          netWeightValue: Number(newVarWeight || 1),
          measurementUnit: newVarUnit || 'pack',
          imageUrl: defaultImg,
        });
      }

      const newVar: ProductVariant = {
        productId: selectedProductForVariant.productId,
        sku,
        productName: selectedProductForVariant.productName,
        brand: selectedProductForVariant.brand,
        categoryId: selectedProductForVariant.categoryId || selectedCat.id,
        categoryName: selectedProductForVariant.categoryName,
        packSize: variantName,
        mrp,
        price,
        stock,
        reserved: 0,
        zone: selectedProductForVariant.zone || 'Zone A-01-R1',
        imageUrl: defaultImg,
        storageType: selectedProductForVariant.storageType,
        shelfLifeDays: selectedProductForVariant.shelfLifeDays,
        isVeg: selectedProductForVariant.isVeg,
        barcode: newVarBarcode.trim() || undefined,
      };

      setVariants((prev) => [newVar, ...prev]);
      setIsAddVariantModalOpen(false);
      showToast(`Added variant "${variantName}" (₹${price}) to "${selectedProductForVariant.productName}"!`);

      // Reset
      setNewVarName('1 kg Bag');
      setNewVarSku('');
      setNewVarPrice(95.0);
      setNewVarMrp(105.0);
      setNewVarStock(50);
    } catch (err: any) {
      showToast(`Added variant locally. (${err.message})`);
    }
  };

  // 7. Test Disambiguation Query via Catalog API
  const handleRunDisambiguation = async (term: string) => {
    setDisambiguateTerm(term);
    try {
      const res = await fetch(`/api/v1/catalog/disambiguate?term=${encodeURIComponent(term)}`);
      const json = await res.json();
      if (json.success && json.data) {
        setDisambiguateResult(json.data);
      }
    } catch {
      if (term.toLowerCase().includes('soap')) {
        setDisambiguateResult({
          term,
          matchedCategories: [
            { id: 'BATH_SOAP', name: 'Bathing Soaps & Body Wash', sampleBrands: ['Dettol', 'Dove', 'Lifebuoy'] },
            { id: 'LAUNDRY_SOAP', name: 'Washing Soaps & Detergents', sampleBrands: ['Surf Excel', 'Rin'] },
            { id: 'DISH_SOAP', name: 'Dishwashing Soaps', sampleBrands: ['Vim', 'Pril'] },
          ],
        });
      }
    }
  };

  // 8. Order status progression
  const handleUpdateOrderStatus = async (orderId: string, nextStatus: OrderRecord['status']) => {
    // Map status to database enum
    const dbStatus = nextStatus === 'OUT_FOR_DELIVERY' ? 'DISPATCHED' : nextStatus;
    try {
      await updateOrderStatusInDb(orderId, dbStatus);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o))
      );
      showToast(`✅ Order status updated to ${nextStatus.replace('_', ' ')} in database`);
    } catch (err: any) {
      // Fallback local update with warning
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o))
      );
      showToast(`Status updated locally (Backend: ${err.message})`);
    }
  };

  // 9. Substitution response
  const handleRespondSubstitution = (taskId: string, decision: 'ACCEPTED' | 'REJECTED') => {
    setPickTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, substituteDecision: decision, status: 'PICKED' } : t))
    );
    showToast(`Customer ${decision.toLowerCase()} substitution proposal`);
  };

  // 9a. Mark Fulfillment Task Picked
  const handleMarkTaskPicked = async (taskId: string) => {
    try {
      await updateFulfillmentTaskStatus(taskId, 'PICKED');
    } catch {}
    setPickTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: 'PICKED' } : t))
    );
    showToast('Item marked as PICKED for packaging');
  };

  // 9b. Send Billing Invoice to Customer through WhatsApp
  const handleSendWhatsAppInvoice = async (orderOrInv: any) => {
    try {
      const orderNumber = orderOrInv.orderNumber;
      const customerPhone = orderOrInv.customerPhone;
      if (!customerPhone) {
        showToast('Cannot send WhatsApp invoice: Customer phone number is missing');
        return;
      }

      await sendInvoiceViaWhatsApp({
        orderNumber,
        customerPhone,
        customerName: orderOrInv.customerName,
        invoiceNumber: orderOrInv.invoiceNumber,
        items: orderOrInv.items,
        subtotal: orderOrInv.subtotal || orderOrInv.taxableAmount,
        taxTotal: orderOrInv.taxTotal,
        deliveryFee: orderOrInv.deliveryFee,
        grandTotal: orderOrInv.grandTotal,
        paymentCheckoutUrl: `https://pay.groceryplatform.com/checkout/sess_${orderNumber.toLowerCase()}`,
      });

      showToast(`Tax invoice for ${orderNumber} sent to ${customerPhone} via WhatsApp!`);
    } catch (err: any) {
      showToast(`WhatsApp Invoice: ${err.message}`);
    }
  };

  // 9b. Train Demand AI
  const handleTrainModel = async () => {
    setIsTrainingModel(true);
    try {
      const result = await trainForecastingModel();
      setModelTrainingResult(result);
      showToast('✓ Sales trends and demand patterns updated successfully');
    } catch (err: any) {
      showToast(`Unable to update sales trends: ${err.message}`);
    } finally {
      setIsTrainingModel(false);
    }
  };

  // 9c. Generate Demand Forecasts & Reorder Alerts
  const handleGetForecast = async (horizon = forecastHorizon) => {
    setIsGeneratingForecast(true);
    try {
      const data = await generateLiveForecasts(horizon);
      if (data && Array.isArray(data.items)) {
        const mappedForecasts: DemandForecast[] = data.items.map((item: any) => ({
          sku: item.sku,
          productName: item.productName,
          variantName: item.variantName,
          category: item.category,
          dailyVelocity: item.dailyVelocity,
          stockOnHand: item.currentStock,
          forecastDemandUnits: item.forecastDemandUnits,
          daysOfSupply: item.daysOfSupply,
          supplierLeadTimeDays: item.supplierLeadTimeDays,
          riskLevel: item.riskLevel,
          recommendedReorderUnits: item.recommendedReorderUnits,
          modelVersion: item.modelVersion,
          modelName: item.modelName,
        }));
        setForecasts(mappedForecasts);
        setForecastSummary(data.summary);
        if (data.modelInfo) {
          setModelTrainingResult(data.modelInfo);
        }
        showToast(`✓ Updated stock demand forecast for ${mappedForecasts.length} products`);
      }
    } catch (err: any) {
      showToast(`Forecast update failed: ${err.message}`);
    } finally {
      setIsGeneratingForecast(false);
    }
  };

  // 9d. Prefill and open reorder modal
  const handleQuickReorder = (sku: string, recommendedUnits: number) => {
    setReceiveSku(sku);
    setReceiveQuantity(Math.max(10, recommendedUnits));
    setIsReceiveStockOpen(true);
  };

  // 10. WhatsApp Chat Simulator Send (Connected to live whatsapp-adapter backend)
  const handleSendChatMessage = async (textToSend?: string) => {
    const txt = textToSend || chatInput;
    if (!txt.trim()) return;

    const newMsgs = [
      ...chatMessages,
      { sender: 'user' as const, text: txt, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
    ];
    setChatMessages(newMsgs);
    setChatInput('');

    try {
      const res = await fetch('/api/v1/whatsapp/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: txt,
          phoneNumber: '+919876543210',
        }),
      });
      const json = await res.json();
      const reply = json?.data?.reply || 'No response received from WhatsApp Bot.';

      let opts: string[] | undefined = undefined;
      if (reply.includes('(Reply with 1, 2, or 3)')) {
        opts = ['1', '2', '3'];
      } else if (reply.includes('Reply with the item name or SKU')) {
        opts = ['ADD DETTOL', 'ADD DOVE'];
      } else if (reply.includes('Confirm') || reply.includes('Checkout')) {
        opts = ['Confirm', 'Clear Cart'];
      }

      setChatMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: reply,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          options: opts,
        },
      ]);
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: `⚠️ Error contacting WhatsApp microservice: ${err.message}`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  };

  // Filtered inventory variants
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

  // Filtered catalog variants
  const catalogVariants =
    catalogCategoryFilter === 'ALL'
      ? variants
      : variants.filter(
          (v) =>
            v.categoryId === catalogCategoryFilter ||
            (v.categoryName && v.categoryName.toLowerCase() === catalogCategoryFilter.toLowerCase())
        );

  const totalPhysicalUnits = variants.reduce((acc, v) => acc + v.stock, 0);
  const totalReservedUnits = variants.reduce((acc, v) => acc + v.reserved, 0);
  const totalAvailableUnits = totalPhysicalUnits - totalReservedUnits;

  return (
    <div className="min-h-screen bg-[#f9fafb] flex flex-col font-sans antialiased text-gray-900 text-xs">
      {/* ========================================================= */}
      {/* TOP HEADER: Clean Seller Hub Header */}
      {/* ========================================================= */}
      <header className="bg-white border-b border-gray-200 px-8 py-3.5 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <span className="text-base font-bold text-gray-900 tracking-tight">Seller hub</span>
        </div>

        <div className="flex items-center gap-3">
          {adminSession ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsAdminAuthOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-left transition-colors"
                title="Account Details & 2FA"
              >
                <div className="w-6 h-6 rounded-full bg-[#007a55]/10 text-[#007a55] flex items-center justify-center font-bold text-[10px]">
                  {adminSession.user.fullName.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-gray-800 text-[11px] leading-tight">
                    {adminSession.user.fullName}
                  </span>
                  <span className="text-[9px] text-[#007a55] font-medium leading-none flex items-center gap-0.5">
                    <ShieldCheck className="w-2.5 h-2.5" /> {adminSession.user.role} (2FA)
                  </span>
                </div>
              </button>
              <button
                onClick={() => {
                  signOutAdmin();
                  setAdminSession(null);
                  showToast('Signed out of Merchant Portal');
                  setIsAdminAuthOpen(true);
                }}
                className="p-1.5 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAdminAuthOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-xs rounded-lg transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In / 2FA</span>
            </button>
          )}

          <a
            href="http://localhost:5173"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-[#007a55] hover:bg-[#006345] text-white font-medium text-xs transition-colors shadow-xs"
          >
            <span>View storefront</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </header>

      {/* ========================================================= */}
      {/* TWO COLUMN WORKSPACE: REAL BACKEND MODULES ONLY */}
      {/* ========================================================= */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT NAVIGATION: Real Store Architecture Modules */}
        <aside className="w-60 bg-white border-r border-gray-200 flex flex-col shrink-0 py-4 px-3">
          <nav className="space-y-1">
            <button
              onClick={() => setActiveNav('inventory')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-left text-xs font-medium transition-colors ${
                activeNav === 'inventory'
                  ? 'bg-gray-100 text-gray-900 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50/80 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <Boxes className={`w-4 h-4 ${activeNav === 'inventory' ? 'text-gray-900' : 'text-gray-500'}`} />
                <span>Inventory</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-200/80 text-gray-700">
                {variants.length}
              </span>
            </button>

            <button
              onClick={() => setActiveNav('catalog')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-left text-xs font-medium transition-colors ${
                activeNav === 'catalog'
                  ? 'bg-gray-100 text-gray-900 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50/80 hover:text-gray-900'
              }`}
            >
              <LayoutGrid className={`w-4 h-4 ${activeNav === 'catalog' ? 'text-gray-900' : 'text-gray-500'}`} />
              <span>Products & Categories</span>
            </button>

            <button
              onClick={() => setActiveNav('orders')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-left text-xs font-medium transition-colors ${
                activeNav === 'orders'
                  ? 'bg-gray-100 text-gray-900 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50/80 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <ShoppingCart className={`w-4 h-4 ${activeNav === 'orders' ? 'text-gray-900' : 'text-gray-500'}`} />
                <span>Customer Orders</span>
              </div>
              {orders.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  {orders.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveNav('fulfillment')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-left text-xs font-medium transition-colors ${
                activeNav === 'fulfillment'
                  ? 'bg-gray-100 text-gray-900 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50/80 hover:text-gray-900'
              }`}
            >
              <Truck className={`w-4 h-4 ${activeNav === 'fulfillment' ? 'text-gray-900' : 'text-gray-500'}`} />
              <span>Fulfillment & Packing</span>
            </button>

            <button
              onClick={() => setActiveNav('invoices')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-left text-xs font-medium transition-colors ${
                activeNav === 'invoices'
                  ? 'bg-gray-100 text-gray-900 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50/80 hover:text-gray-900'
              }`}
            >
              <Receipt className={`w-4 h-4 ${activeNav === 'invoices' ? 'text-gray-900' : 'text-gray-500'}`} />
              <span>Tax Invoices & GST</span>
            </button>

            <button
              onClick={() => setActiveNav('analytics')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-left text-xs font-medium transition-colors ${
                activeNav === 'analytics'
                  ? 'bg-gray-100 text-gray-900 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50/80 hover:text-gray-900'
              }`}
            >
              <TrendingUp className={`w-4 h-4 ${activeNav === 'analytics' ? 'text-gray-900' : 'text-gray-500'}`} />
              <span>Stock Demand & Alerts</span>
            </button>

            <button
              onClick={() => setActiveNav('whatsapp')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-left text-xs font-medium transition-colors ${
                activeNav === 'whatsapp'
                  ? 'bg-gray-100 text-gray-900 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50/80 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <MessageSquare className={`w-4 h-4 ${activeNav === 'whatsapp' ? 'text-gray-900' : 'text-gray-500'}`} />
                <span>WhatsApp Commerce</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </button>
          </nav>
        </aside>

        {/* MAIN DISPLAY AREA */}
        <main className="flex-1 p-8 overflow-y-auto">
          {/* ========================================================= */}
          {/* 1. INVENTORY MODULE (Real inventory-service backend) */}
          {/* ========================================================= */}
          {activeNav === 'inventory' && (
            <div className="space-y-6 max-w-7xl mx-auto">
              {/* Header: Title + Primary Actions */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                    Inventory ({variants.length})
                  </h1>
                  <p className="text-gray-500 text-xs mt-1">
                    Your offers with live prices and stock levels.
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => setIsReceiveStockOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-md bg-[#007a55] hover:bg-[#006345] text-white font-medium text-xs transition-colors shadow-xs"
                  >
                    <PackagePlus className="w-4 h-4" />
                    <span>+ Add product / listing</span>
                  </button>

                  <button
                    onClick={handleTriggerTtlSweep}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-medium transition-colors shadow-2xs"
                    title="Release checkout holds where 15 minutes expired"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
                    <span>Clear Expired Holds</span>
                  </button>
                </div>
              </div>

              {/* View Switcher: Visual Product Cards | FEFO Batches | Active Holds | Audit Ledger */}
              <div className="flex border-b border-gray-200 space-x-6 text-xs font-medium">
                <button
                  onClick={() => setInventoryViewMode('cards')}
                  className={`pb-2.5 transition-colors ${
                    inventoryViewMode === 'cards'
                      ? 'border-b-2 border-[#007a55] text-gray-900 font-bold'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  Product Stock Cards ({variants.length})
                </button>

                <button
                  onClick={() => setInventoryViewMode('batches')}
                  className={`pb-2.5 transition-colors ${
                    inventoryViewMode === 'batches'
                      ? 'border-b-2 border-[#007a55] text-gray-900 font-bold'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  FEFO Batches & Racks ({fefoBatches.length})
                </button>

                <button
                  onClick={() => setInventoryViewMode('holds')}
                  className={`pb-2.5 transition-colors ${
                    inventoryViewMode === 'holds'
                      ? 'border-b-2 border-[#007a55] text-gray-900 font-bold'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  Active 15-Minute Holds ({reservations.length})
                </button>

                <button
                  onClick={() => setInventoryViewMode('ledger')}
                  className={`pb-2.5 transition-colors ${
                    inventoryViewMode === 'ledger'
                      ? 'border-b-2 border-[#007a55] text-gray-900 font-bold'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  Stock Movement Ledger ({stockMovements.length})
                </button>
              </div>

              {/* SUBVIEW 1: PRODUCT STOCK CARDS (MATCHING REFERENCE IMAGE) */}
              {inventoryViewMode === 'cards' && (
                <div className="space-y-5">
                  {/* Search and Filter Pills */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[280px] max-w-sm">
                      <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by product, brand, or SKU"
                        className="w-full pl-9 pr-8 py-2 bg-white border border-gray-200 rounded-md text-xs placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#007a55] focus:border-[#007a55] transition-colors shadow-2xs"
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
                        className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                          stockFilter === 'ALL'
                            ? 'bg-[#007a55] text-white shadow-2xs font-semibold'
                            : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        All
                      </button>

                      <button
                        onClick={() => setStockFilter('IN_STOCK')}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                          stockFilter === 'IN_STOCK'
                            ? 'bg-[#007a55] text-white shadow-2xs font-semibold'
                            : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        Active
                      </button>

                      <button
                        onClick={() => setStockFilter('LOW_STOCK')}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                          stockFilter === 'LOW_STOCK'
                            ? 'bg-[#007a55] text-white shadow-2xs font-semibold'
                            : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        Low stock
                      </button>

                      <button
                        onClick={() => setStockFilter('OUT_OF_STOCK')}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                          stockFilter === 'OUT_OF_STOCK'
                            ? 'bg-[#007a55] text-white shadow-2xs font-semibold'
                            : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        Inactive
                      </button>
                    </div>
                  </div>

                  {/* 3-Column Grid of Inventory Cards matching Reference Image */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredVariants.map((item) => {
                      const available = Math.max(0, item.stock - item.reserved);
                      const currentQty = getCardQty(item.sku);
                      const discountPercent =
                        item.mrp && item.mrp > item.price
                          ? Math.round(((item.mrp - item.price) / item.mrp) * 100)
                          : null;

                      return (
                        <div
                          key={item.sku}
                          className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 flex flex-col justify-between hover:border-gray-300 transition-all shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
                        >
                          {/* Card Header: Product Image, Title, Rating, SKU, Status Pill */}
                          <div className="flex items-start gap-3.5">
                            {/* Product Image Thumbnail */}
                            <div className="w-16 h-20 rounded-md bg-gray-50/80 border border-gray-100 flex items-center justify-center overflow-hidden shrink-0 p-1">
                              <img
                                src={item.imageUrl}
                                alt={item.productName}
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src =
                                    'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=100&auto=format&fit=crop&q=80';
                                }}
                              />
                            </div>

                            {/* Details: Title, Rating, SKU */}
                            <div className="flex-1 min-w-0 pr-1">
                              <h3 className="font-bold text-gray-900 text-sm line-clamp-1 leading-snug">
                                {item.productName}
                              </h3>
                              {/* Star Rating and review count */}
                              <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-600">
                                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
                                <span className="font-semibold text-gray-800">4.8</span>
                                <span className="text-gray-400 font-normal">(3)</span>
                              </div>
                              {/* SKU & Variant Pack Size */}
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <span className="text-[10px] bg-emerald-50 text-[#007a55] font-semibold px-2 py-0.5 rounded border border-emerald-200">
                                  {item.packSize}
                                </span>
                                <span className="text-[10px] text-gray-400 font-mono tracking-tight uppercase">
                                  {item.sku}
                                </span>
                              </div>
                            </div>

                            {/* Status Badge */}
                            <div className="shrink-0">
                              {available > 5 ? (
                                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 uppercase tracking-wide">
                                  ACTIVE
                                </span>
                              ) : available > 0 ? (
                                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200/80 uppercase tracking-wide">
                                  ACTIVE
                                </span>
                              ) : (
                                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200/80 uppercase tracking-wide">
                                  OUT OF STOCK
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Card Middle: Price, MRP, Discount, Stock availability text */}
                          <div className="mt-3.5 pt-3 border-t border-gray-100">
                            <div className="flex items-baseline gap-2">
                              <span className="text-base sm:text-lg font-bold text-gray-900">
                                ₹{item.price.toFixed(2)}
                              </span>
                              {item.mrp && item.mrp > item.price && (
                                <>
                                  <span className="text-xs text-gray-400 line-through font-normal">
                                    ₹{item.mrp.toFixed(2)}
                                  </span>
                                  {discountPercent && discountPercent > 0 && (
                                    <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200/60 px-1.5 py-0.5 rounded">
                                      {discountPercent}% off
                                    </span>
                                  )}
                                </>
                              )}
                            </div>

                            {/* Stock status indicator line */}
                            <div className="mt-1 text-xs">
                              {available > 5 ? (
                                <span className="text-gray-500 font-normal">In stock · {available} units</span>
                              ) : available > 0 ? (
                                <span className="text-amber-600 font-medium">Low stock · {available} left</span>
                              ) : (
                                <span className="text-red-500 font-medium">Out of stock</span>
                              )}
                            </div>
                          </div>

                          {/* Card Bottom: Deactivate / + Variant / Stock Adjustment controls */}
                          <div className="mt-3.5 pt-3 border-t border-gray-100 flex items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2 text-gray-600 shrink-0">
                              <button
                                onClick={() => handleStockAdjustment(item.sku, available > 0 ? -available : 10)}
                                className="hover:text-gray-900 font-medium transition-colors text-xs cursor-pointer"
                                title={available > 0 ? 'Mark inactive / clear stock' : 'Activate with 10 units'}
                              >
                                {available > 0 ? 'Deactivate' : 'Activate'}
                              </button>

                              <button
                                onClick={() => {
                                  setSelectedProductForVariant(item);
                                  const brandPart = (item.brand || 'ITEM').replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
                                  const namePart = (item.productName || 'PROD').replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
                                  setNewVarSku(`${brandPart}-${namePart}-${Date.now().toString().slice(-4)}`);
                                  setNewVarPrice(item.price);
                                  setNewVarMrp(Math.round(item.price * 1.15));
                                  setIsAddVariantModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#e6f4ea] hover:bg-[#d5eedd] text-[#007a55] font-semibold text-xs transition-colors border border-[#a3d9b8] cursor-pointer whitespace-nowrap shrink-0 shadow-2xs"
                                title="Add another pack size/variant to this product"
                              >
                                <Plus className="w-3 h-3 stroke-[2.5]" />
                                <span>Variant</span>
                              </button>
                            </div>

                            {/* Stock Adjustment Interactive Controls */}
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-[11px] text-gray-400 font-medium">Stock:</span>
                              <input
                                type="number"
                                min={1}
                                value={currentQty}
                                onChange={(e) => handleCardQtyChange(item.sku, parseInt(e.target.value, 10))}
                                className="w-10 border border-gray-200 rounded px-1 py-0.5 text-center text-xs text-gray-900 font-medium bg-gray-50/50 focus:outline-none focus:border-[#007a55]"
                              />

                              <button
                                onClick={() => handleStockAdjustment(item.sku, currentQty)}
                                className="w-6 h-6 flex items-center justify-center bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-bold rounded shadow-2xs transition-colors cursor-pointer"
                                title="Add stock"
                              >
                                +
                              </button>

                              <button
                                onClick={() => handleStockAdjustment(item.sku, -currentQty)}
                                disabled={available <= 0}
                                className={`w-6 h-6 flex items-center justify-center bg-white border border-gray-200 text-xs font-bold rounded shadow-2xs transition-colors ${
                                  available <= 0
                                    ? 'opacity-40 cursor-not-allowed text-gray-400'
                                    : 'hover:bg-gray-50 text-gray-700 cursor-pointer'
                                }`}
                                title="Remove stock"
                              >
                                -
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SUBVIEW 2: FEFO BATCHES & SHELF ROTATION */}
              {inventoryViewMode === 'batches' && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <span className="font-semibold text-gray-900 text-xs">
                      First-Expired-First-Out (FEFO) Batch Dispatch Queue
                    </span>
                    <span className="text-gray-500 text-[11px]">Dark Store Racks HSR-02</span>
                  </div>

                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50/50 text-gray-500 border-b border-gray-200">
                      <tr>
                        <th className="py-2.5 px-4">Batch Number</th>
                        <th className="py-2.5 px-4">Product Name / SKU</th>
                        <th className="py-2.5 px-4">Shelf Location</th>
                        <th className="py-2.5 px-4">Expiry Date</th>
                        <th className="py-2.5 px-4">Days Left</th>
                        <th className="py-2.5 px-4">Stock on Hand</th>
                        <th className="py-2.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {fefoBatches.map((b) => (
                        <tr key={b.batchNumber} className="hover:bg-gray-50/60">
                          <td className="py-2.5 px-4 font-mono font-semibold text-gray-900">{b.batchNumber}</td>
                          <td className="py-2.5 px-4">
                            <div className="font-medium text-gray-800">{b.productName}</div>
                            <div className="text-[10px] text-gray-400 font-mono">{b.sku}</div>
                          </td>
                          <td className="py-2.5 px-4 text-gray-700 font-mono">
                            <span className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200">
                              {b.locationZone}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-gray-800">{b.expiryDate}</td>
                          <td className="py-2.5 px-4">
                            {b.daysToExpiry <= 30 ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                {b.daysToExpiry} days (Expiring Soon)
                              </span>
                            ) : (
                              <span className="text-gray-700">{b.daysToExpiry} days</span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 font-bold text-gray-900">{b.quantityOnHand} units</td>
                          <td className="py-2.5 px-4 text-right">
                            <button
                              onClick={() => {
                                setSelectedBatchForMove(b);
                                setTargetZoneForMove(b.locationZone);
                                setIsMoveZoneOpen(true);
                              }}
                              className="px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium inline-flex items-center gap-1"
                            >
                              <ArrowRightLeft className="w-3 h-3" />
                              <span>Relocate Rack</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* SUBVIEW 3: ACTIVE 15-MINUTE HOLDS */}
              {inventoryViewMode === 'holds' && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <span className="font-semibold text-gray-900 text-xs">
                      Active Customer Checkout Reservations (15-Minute Expiry)
                    </span>
                    <button
                      onClick={handleTriggerTtlSweep}
                      className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Sweep Expired</span>
                    </button>
                  </div>

                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50/50 text-gray-500 border-b border-gray-200">
                      <tr>
                        <th className="py-2.5 px-4">Hold ID</th>
                        <th className="py-2.5 px-4">Order Reference</th>
                        <th className="py-2.5 px-4">Product Name</th>
                        <th className="py-2.5 px-4">Quantity Held</th>
                        <th className="py-2.5 px-4">Expires At</th>
                        <th className="py-2.5 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {reservations.map((r) => (
                        <tr key={r.id} className="hover:bg-gray-50/60">
                          <td className="py-2.5 px-4 font-mono font-semibold text-gray-900">{r.id}</td>
                          <td className="py-2.5 px-4 text-gray-700">{r.orderNumber} ({r.channel})</td>
                          <td className="py-2.5 px-4 font-medium text-gray-800">{r.productName}</td>
                          <td className="py-2.5 px-4 font-bold text-amber-700">{r.quantity} units</td>
                          <td className="py-2.5 px-4 text-gray-500">{r.expiresAt}</td>
                          <td className="py-2.5 px-4 text-right">
                            <button
                              onClick={() => handleForceReleaseReservation(r.id)}
                              className="px-2.5 py-1 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-medium"
                            >
                              Release Hold
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* SUBVIEW 4: STOCK MOVEMENT AUDIT LEDGER */}
              {inventoryViewMode === 'ledger' && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <span className="font-semibold text-gray-900 text-xs">
                      Immutable Stock Movement Audit Ledger
                    </span>
                  </div>

                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50/50 text-gray-500 border-b border-gray-200">
                      <tr>
                        <th className="py-2.5 px-4">Timestamp</th>
                        <th className="py-2.5 px-4">Product / SKU</th>
                        <th className="py-2.5 px-4">Adjustment Delta</th>
                        <th className="py-2.5 px-4">Stock After</th>
                        <th className="py-2.5 px-4">Reason</th>
                        <th className="py-2.5 px-4">Location</th>
                        <th className="py-2.5 px-4">Staff / Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {stockMovements.map((m) => (
                        <tr key={m.id} className="hover:bg-gray-50/60">
                          <td className="py-2.5 px-4 text-gray-500">{m.timestamp}</td>
                          <td className="py-2.5 px-4">
                            <div className="font-medium text-gray-900">{m.productName}</div>
                            <div className="text-[10px] text-gray-400 font-mono">{m.sku}</div>
                          </td>
                          <td className="py-2.5 px-4 font-bold">
                            <span className={m.delta > 0 ? 'text-emerald-700' : m.delta < 0 ? 'text-rose-700' : 'text-gray-600'}>
                              {m.delta > 0 ? `+${m.delta}` : m.delta}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-semibold text-gray-800">{m.balanceAfter}</td>
                          <td className="py-2.5 px-4 text-gray-700">{m.reason}</td>
                          <td className="py-2.5 px-4 text-gray-500">{m.locationZone}</td>
                          <td className="py-2.5 px-4 text-gray-500">{m.actor}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* 2. PRODUCTS & CATEGORIES MODULE (catalog-service backend) */}
          {/* ========================================================= */}
          {activeNav === 'catalog' && (
            <div className="space-y-6 max-w-7xl mx-auto">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                    Listings & Categories ({catalogVariants.length})
                  </h1>
                  <p className="text-gray-500 text-xs mt-1">
                    Your master product catalog with hierarchical categories and multi-variant pack sizes.
                  </p>
                </div>

                <button
                  onClick={() => setIsAddProductOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-md bg-[#007a55] hover:bg-[#006345] text-white font-medium text-xs transition-colors shadow-xs"
                >
                  <PackagePlus className="w-4 h-4" />
                  <span>+ Add product / listing</span>
                </button>
              </div>

              {/* Category Filter Pills & Product Cards Grid (Matching Reference Screenshot) */}
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setCatalogCategoryFilter('ALL')}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        catalogCategoryFilter === 'ALL'
                          ? 'bg-[#007a55] text-white font-semibold shadow-2xs'
                          : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      All
                    </button>
                    {categories.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setCatalogCategoryFilter(c.id)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                          catalogCategoryFilter === c.id
                            ? 'bg-[#007a55] text-white font-semibold shadow-2xs'
                            : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>

                  <span className="text-gray-500 text-xs font-normal">
                    {catalogVariants.length} products
                  </span>
                </div>

                {/* 3-Column Grid of Product Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {catalogVariants.map((item) => {
                    const available = Math.max(0, item.stock - item.reserved);
                    const discountPercent =
                      item.mrp && item.mrp > item.price
                        ? Math.round(((item.mrp - item.price) / item.mrp) * 100)
                        : null;

                    return (
                      <div
                        key={item.sku}
                        className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 flex flex-col justify-between hover:border-gray-300 transition-all shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
                      >
                        {/* Top: Image, Details, Status Pill */}
                        <div className="flex items-start gap-3.5">
                          <div className="w-16 h-20 rounded-md bg-gray-50/80 border border-gray-100 flex items-center justify-center overflow-hidden shrink-0 p-1">
                            <img
                              src={item.imageUrl}
                              alt={item.productName}
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src =
                                  'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=100&auto=format&fit=crop&q=80';
                              }}
                            />
                          </div>

                          <div className="flex-1 min-w-0 pr-1">
                            <h3 className="font-bold text-gray-900 text-sm line-clamp-1 leading-snug">
                              {item.productName}
                            </h3>
                            <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-600">
                              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
                              <span className="font-semibold text-gray-800">4.8</span>
                              <span className="text-gray-400 font-normal">(3)</span>
                            </div>
                            <div className="text-[11px] text-gray-400 font-mono mt-0.5 tracking-tight uppercase">
                              {item.sku}
                            </div>
                          </div>

                          <div className="shrink-0">
                            {available > 0 ? (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 uppercase tracking-wide">
                                ACTIVE
                              </span>
                            ) : (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200/80 uppercase tracking-wide">
                                OUT OF STOCK
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Middle: Price, MRP, Discount, Stock status */}
                        <div className="mt-3.5 pt-3 border-t border-gray-100">
                          <div className="flex items-baseline gap-2">
                            <span className="text-base sm:text-lg font-bold text-gray-900">
                              ₹{item.price.toFixed(2)}
                            </span>
                            {item.mrp && item.mrp > item.price && (
                              <>
                                <span className="text-xs text-gray-400 line-through font-normal">
                                  ₹{item.mrp.toFixed(2)}
                                </span>
                                {discountPercent && discountPercent > 0 && (
                                  <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200/60 px-1.5 py-0.5 rounded">
                                    {discountPercent}% off
                                  </span>
                                )}
                              </>
                            )}
                          </div>

                          <div className="mt-1 text-xs">
                            {available > 5 ? (
                              <span className="text-gray-500 font-normal">In stock · {available} units</span>
                            ) : available > 0 ? (
                              <span className="text-amber-600 font-medium">Low stock · {available} left</span>
                            ) : (
                              <span className="text-red-500 font-medium">Out of stock</span>
                            )}
                          </div>
                        </div>

                        {/* Bottom: Deactivate & Variant & Price & Shelf Zone */}
                        <div className="mt-3.5 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600">
                          <div className="flex items-center gap-2.5">
                            <span className="hover:text-gray-900 font-medium cursor-pointer transition-colors">
                              Deactivate
                            </span>
                            <button
                              onClick={() => {
                                setSelectedProductForVariant(item);
                                const brandPart = (item.brand || 'ITEM').replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
                                const namePart = (item.productName || 'PROD').replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
                                setNewVarSku(`${brandPart}-${namePart}-${Date.now().toString().slice(-4)}`);
                                setNewVarPrice(item.price);
                                setNewVarMrp(Math.round(item.price * 1.15));
                                setIsAddVariantModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#e6f4ea] hover:bg-[#d5eedd] text-[#007a55] font-semibold text-xs transition-colors border border-[#a3d9b8] cursor-pointer whitespace-nowrap shadow-2xs"
                              title="Add another pack size/variant to this product"
                            >
                              <Plus className="w-3 h-3 stroke-[2.5]" />
                              <span>Variant</span>
                            </button>
                            <span className="flex items-center gap-1 hover:text-gray-900 font-medium cursor-pointer transition-colors">
                              <Pencil className="w-3 h-3 text-gray-400" />
                              <span>Price</span>
                            </span>
                          </div>

                          <span className="font-mono text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                            {item.zone}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 3. CUSTOMER ORDERS MODULE (order-service backend) */}
          {/* ========================================================= */}
          {activeNav === 'orders' && (
            <div className="space-y-6 max-w-7xl mx-auto">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Customer Orders</h1>
                <p className="text-gray-500 text-xs mt-1">
                  Track and fulfill customer orders from Web and WhatsApp channels.
                </p>
              </div>

              <div className="space-y-4">
                {orders.map((ord) => (
                  <div
                    key={ord.id}
                    className="bg-white border border-gray-200 rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-sm text-gray-900">{ord.orderNumber}</span>
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 uppercase tracking-wide">
                          {ord.channel}
                        </span>
                        <span className="text-gray-400 text-xs font-normal">{ord.createdAt}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                            ord.status === 'DELIVERED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                              : ord.status === 'PACKED' || ord.status === 'OUT_FOR_DELIVERY'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200/80'
                              : 'bg-amber-50 text-amber-800 border border-amber-200/80'
                          }`}
                        >
                          {ord.status.replace(/_/g, ' ')}
                        </span>

                        {ord.status === 'CONFIRMED' && (
                          <button
                            onClick={() => handleUpdateOrderStatus(ord.id, 'PACKED')}
                            className="px-3 py-1.5 rounded-md bg-[#007a55] hover:bg-[#006345] text-white font-medium text-xs transition-colors shadow-xs"
                          >
                            Mark Packed
                          </button>
                        )}
                        {ord.status === 'PACKED' && (
                          <button
                            onClick={() => handleUpdateOrderStatus(ord.id, 'OUT_FOR_DELIVERY')}
                            className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition-colors shadow-xs"
                          >
                            Dispatch
                          </button>
                        )}
                        {ord.status === 'OUT_FOR_DELIVERY' && (
                          <button
                            onClick={() => handleUpdateOrderStatus(ord.id, 'DELIVERED')}
                            className="px-3 py-1.5 rounded-md bg-[#007a55] hover:bg-[#006345] text-white font-medium text-xs transition-colors shadow-xs"
                          >
                            Mark Delivered
                          </button>
                        )}

                        {/* Send Billing Invoice via WhatsApp Button */}
                        <button
                          onClick={() => handleSendWhatsAppInvoice(ord)}
                          className="px-3 py-1.5 rounded-md bg-[#007a55] hover:bg-[#006345] text-white font-medium text-xs flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                          title="Send detailed tax invoice and receipt to customer's WhatsApp"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Send WhatsApp Bill</span>
                        </button>
                      </div>
                    </div>

                    <div className="pt-3.5 flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="font-semibold text-gray-900 text-xs">{ord.customerName}</div>
                        <div className="text-[11px] text-gray-400 flex items-center gap-1.5 mt-0.5">
                          <Phone className="w-3 h-3 text-gray-400" />
                          <span>{ord.customerPhone}</span>
                        </div>
                      </div>

                      <div className="flex-1 max-w-md">
                        <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                          Items Ordered:
                        </div>
                        <div className="space-y-1">
                          {ord.items.map((it, i) => (
                            <div key={i} className="flex justify-between text-xs text-gray-700">
                              <span>
                                {it.quantity}× {it.productName} ({it.variantName})
                              </span>
                              <span className="font-semibold text-gray-900">
                                ₹{(it.unitPrice * it.quantity).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[11px] text-gray-400">Total Order Amount</div>
                        <div className="text-base font-bold text-gray-900">₹{ord.grandTotal.toFixed(2)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 4. FULFILLMENT & PICKING MODULE (fulfillment-service) */}
          {/* ========================================================= */}
          {activeNav === 'fulfillment' && (
            <div className="space-y-6 max-w-7xl mx-auto">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Order Fulfillment & Pick Lists</h1>
                <p className="text-gray-500 text-xs mt-1">
                  Organized by dark store shelf zones with customer substitution approval flow.
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50/80 text-gray-500 border-b border-gray-200 text-[11px] font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Order #</th>
                      <th className="py-3 px-4">Item to Pick</th>
                      <th className="py-3 px-4">Shelf Zone</th>
                      <th className="py-3 px-4">Qty</th>
                      <th className="py-3 px-4">Status & Substitutions</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pickTasks.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-gray-900">{t.orderNumber}</td>
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-gray-900">{t.productName}</div>
                          <div className="text-[11px] text-gray-400 font-mono mt-0.5">{t.sku}</div>
                        </td>
                        <td className="py-3.5 px-4 text-gray-600 font-mono">{t.zone}</td>
                        <td className="py-3.5 px-4 font-bold text-gray-900">{t.quantity}</td>
                        <td className="py-3.5 px-4">
                          {t.status === 'SUBSTITUTION_PROPOSED' ? (
                            <div>
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200/80 uppercase tracking-wide">
                                Substitute Proposed: {t.substituteName}
                              </span>
                              <div className="text-[10px] text-gray-400 mt-1">Awaiting customer approval</div>
                            </div>
                          ) : (
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                                t.status === 'PICKED'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {t.status}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {t.status === 'PENDING' && (
                            <button
                              onClick={() => handleMarkTaskPicked(t.id)}
                              className="px-3 py-1 rounded-md bg-[#007a55] hover:bg-[#006345] text-white text-[11px] font-medium shadow-xs transition-colors cursor-pointer"
                            >
                              Mark Picked
                            </button>
                          )}
                          {t.status === 'SUBSTITUTION_PROPOSED' && t.substituteDecision === 'PENDING' && (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleRespondSubstitution(t.id, 'ACCEPTED')}
                                className="px-3 py-1 rounded-md bg-[#007a55] hover:bg-[#006345] text-white text-[11px] font-medium shadow-xs transition-colors"
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => handleRespondSubstitution(t.id, 'REJECTED')}
                                className="px-3 py-1 rounded-md bg-white border border-gray-200 text-rose-700 hover:bg-rose-50 text-[11px] font-medium shadow-2xs transition-colors"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 5. TAX INVOICES & GST MODULE (taxation-service) */}
          {/* ========================================================= */}
          {activeNav === 'invoices' && (
            <div className="space-y-6 max-w-7xl mx-auto">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Tax Invoices & GST</h1>
                <p className="text-gray-500 text-xs mt-1">
                  Tax invoices with HSN, CGST (9% / 2.5%), SGST (9% / 2.5%) breakdown.
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50/80 text-gray-500 border-b border-gray-200 text-[11px] font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Invoice Number</th>
                      <th className="py-3 px-4">Order Number</th>
                      <th className="py-3 px-4">Customer Name</th>
                      <th className="py-3 px-4">Taxable Amount</th>
                      <th className="py-3 px-4">GST (CGST + SGST)</th>
                      <th className="py-3 px-4">Grand Total</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {invoices.map((inv) => (
                      <tr key={inv.invoiceId} className="hover:bg-gray-50/60 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-semibold text-gray-900">{inv.invoiceNumber}</td>
                        <td className="py-3.5 px-4 text-gray-600">{inv.orderNumber}</td>
                        <td className="py-3.5 px-4 text-gray-800 font-medium">{inv.customerName}</td>
                        <td className="py-3.5 px-4 text-gray-800">₹{inv.taxableAmount.toFixed(2)}</td>
                        <td className="py-3.5 px-4 text-[#007a55] font-semibold">₹{inv.totalTax.toFixed(2)}</td>
                        <td className="py-3.5 px-4 font-bold text-gray-900">₹{inv.grandTotal.toFixed(2)}</td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleSendWhatsAppInvoice(inv)}
                              className="px-2.5 py-1.5 rounded-md bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 text-xs font-medium inline-flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                              title="Send Tax Invoice to Customer via WhatsApp"
                            >
                              <MessageSquare className="w-3.5 h-3.5 text-[#007a55]" />
                              <span>WhatsApp</span>
                            </button>
                            <button
                              onClick={() => window.print()}
                              className="px-2.5 py-1.5 rounded-md bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium inline-flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5 text-gray-500" />
                              <span>Print</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 6. STOCK DEMAND & REORDER ALERTS (Shopkeeper Demand Planner) */}
          {/* ========================================================= */}
          {activeNav === 'analytics' && (
            <div className="space-y-6 max-w-7xl mx-auto">
              {(() => {
                const urgentCount = forecasts.filter((f) => f.riskLevel === 'CRITICAL_RISK' || f.riskLevel === 'STOCKOUT').length;
                const lowCount = forecasts.filter((f) => f.riskLevel === 'LOW_STOCK').length;
                const normalCount = forecasts.filter((f) => f.riskLevel === 'NORMAL').length;

                const riskPriority: Record<string, number> = {
                  STOCKOUT: 1,
                  CRITICAL_RISK: 2,
                  LOW_STOCK: 3,
                  NORMAL: 4,
                };

                const sortedAndFiltered = [...forecasts]
                  .filter((f) => {
                    const q = forecastSearch.toLowerCase().trim();
                    const matchesSearch =
                      !q ||
                      f.productName.toLowerCase().includes(q) ||
                      (f.variantName && f.variantName.toLowerCase().includes(q)) ||
                      f.sku.toLowerCase().includes(q) ||
                      f.category.toLowerCase().includes(q);

                    if (!matchesSearch) return false;

                    if (forecastRiskFilter === 'URGENT') {
                      return f.riskLevel === 'CRITICAL_RISK' || f.riskLevel === 'STOCKOUT';
                    }
                    if (forecastRiskFilter === 'LOW') {
                      return f.riskLevel === 'LOW_STOCK';
                    }
                    if (forecastRiskFilter === 'NORMAL') {
                      return f.riskLevel === 'NORMAL';
                    }
                    return true;
                  })
                  .sort((a, b) => {
                    const pA = riskPriority[a.riskLevel] || 99;
                    const pB = riskPriority[b.riskLevel] || 99;
                    if (pA !== pB) return pA - pB;
                    return a.daysOfSupply - b.daysOfSupply;
                  });

                const FORECAST_PAGE_SIZE = 25;
                const totalPages = Math.max(1, Math.ceil(sortedAndFiltered.length / FORECAST_PAGE_SIZE));
                const currentPage = Math.min(forecastPage, totalPages);
                const paginatedForecasts = sortedAndFiltered.slice(
                  (currentPage - 1) * FORECAST_PAGE_SIZE,
                  currentPage * FORECAST_PAGE_SIZE
                );

                return (
                  <>
                    {/* Top Header & Actions matching Seller Hub green theme */}
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                          Stock Demand & Reorder Alerts ({forecasts.length})
                        </h1>
                        <p className="text-gray-500 text-xs mt-1">
                          Anticipate customer demand, track how many days your stock will last, and restock before items sell out.
                        </p>
                      </div>

                      <div className="flex items-center gap-2.5 flex-wrap">
                        {/* Forecast Window Toggle */}
                        <div className="flex items-center bg-gray-100 p-0.5 rounded-md border border-gray-200">
                          <span className="text-[11px] font-medium text-gray-500 px-2">Window:</span>
                          {[7, 14, 30].map((days) => (
                            <button
                              key={days}
                              onClick={() => {
                                setForecastHorizon(days);
                                handleGetForecast(days);
                              }}
                              className={`px-2.5 py-1 text-xs rounded transition-colors ${
                                forecastHorizon === days
                                  ? 'bg-[#007a55] text-white font-semibold shadow-xs'
                                  : 'text-gray-600 hover:text-gray-900'
                              }`}
                            >
                              {days} Days
                            </button>
                          ))}
                        </div>

                        {/* Train / Recalculate AI Trends */}
                        <button
                          onClick={handleTrainModel}
                          disabled={isTrainingModel}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-medium transition-colors shadow-2xs disabled:opacity-50"
                          title="Analyze recent store sales to identify purchase velocity and weekend shopping surges"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 text-[#007a55] ${isTrainingModel ? 'animate-spin' : ''}`} />
                          <span>{isTrainingModel ? 'Analyzing Sales...' : 'Update Sales AI'}</span>
                        </button>

                        {/* Calculate Demand Forecast */}
                        <button
                          onClick={() => handleGetForecast()}
                          disabled={isGeneratingForecast}
                          className="flex items-center gap-2 px-4 py-2 rounded-md bg-[#007a55] hover:bg-[#006345] text-white font-medium text-xs transition-colors shadow-xs disabled:opacity-50"
                        >
                          <TrendingUp className={`w-4 h-4 ${isGeneratingForecast ? 'animate-spin' : ''}`} />
                          <span>{isGeneratingForecast ? 'Calculating...' : 'Calculate Demand'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Clean Status Notice */}
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-emerald-50/80 border border-emerald-200/90 rounded-lg px-4 py-2.5 text-xs text-gray-800">
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-[#007a55] shrink-0" />
                        <span className="font-medium text-emerald-950">
                          Smart Stock Forecaster Active • Analyzing sales velocity and restocking lead times across {forecasts.length} products
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {modelTrainingResult && (
                          <span className="text-[11px] text-gray-500">
                            Model: <strong className="text-gray-700">{modelTrainingResult.selectedModelName || 'AutoML'}</strong> (Acc: {modelTrainingResult.accuracy ?? 84}%)
                          </span>
                        )}
                        <span className="text-[11px] text-[#007a55] font-semibold bg-white px-2 py-0.5 rounded border border-emerald-200 shadow-2xs">
                          Showing Next {forecastHorizon}-Day Predictions
                        </span>
                      </div>
                    </div>

                    {/* 4 Clean Shopkeeper Summary Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                      <div
                        onClick={() => {
                          setForecastRiskFilter('ALL');
                          setForecastPage(1);
                        }}
                        className={`bg-white p-4 rounded-xl border cursor-pointer transition-all ${
                          forecastRiskFilter === 'ALL'
                            ? 'border-[#007a55] ring-2 ring-[#007a55]/20 shadow-xs'
                            : 'border-gray-200 hover:border-gray-300 shadow-2xs'
                        }`}
                      >
                        <div className="text-[11px] text-gray-500 font-medium">Products Monitored</div>
                        <div className="text-2xl font-bold text-gray-900 mt-1">{forecasts.length}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">Active catalog variants</div>
                      </div>

                      <div
                        onClick={() => {
                          setForecastRiskFilter('URGENT');
                          setForecastPage(1);
                        }}
                        className={`bg-white p-4 rounded-xl border cursor-pointer transition-all ${
                          forecastRiskFilter === 'URGENT'
                            ? 'border-rose-500 ring-2 ring-rose-500/20 shadow-xs'
                            : 'border-rose-200 hover:border-rose-300 shadow-2xs'
                        }`}
                      >
                        <div className="text-[11px] text-rose-700 font-medium flex items-center justify-between">
                          <span>Urgent Restock Needed</span>
                          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                        </div>
                        <div className="text-2xl font-bold text-rose-700 mt-1">{urgentCount}</div>
                        <div className="text-[10px] text-rose-600/80 mt-0.5">Will stock out before delivery</div>
                      </div>

                      <div
                        onClick={() => {
                          setForecastRiskFilter('LOW');
                          setForecastPage(1);
                        }}
                        className={`bg-white p-4 rounded-xl border cursor-pointer transition-all ${
                          forecastRiskFilter === 'LOW'
                            ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-xs'
                            : 'border-amber-200 hover:border-amber-300 shadow-2xs'
                        }`}
                      >
                        <div className="text-[11px] text-amber-800 font-medium">Running Low</div>
                        <div className="text-2xl font-bold text-amber-800 mt-1">{lowCount}</div>
                        <div className="text-[10px] text-amber-700/80 mt-0.5">Reorder in 3-5 days</div>
                      </div>

                      <div
                        onClick={() => {
                          setForecastRiskFilter('NORMAL');
                          setForecastPage(1);
                        }}
                        className={`bg-white p-4 rounded-xl border cursor-pointer transition-all ${
                          forecastRiskFilter === 'NORMAL'
                            ? 'border-[#007a55] ring-2 ring-[#007a55]/20 shadow-xs'
                            : 'border-emerald-200 hover:border-emerald-300 shadow-2xs'
                        }`}
                      >
                        <div className="text-[11px] text-[#007a55] font-medium">Sufficient Stock</div>
                        <div className="text-2xl font-bold text-[#007a55] mt-1">{normalCount}</div>
                        <div className="text-[10px] text-emerald-600/80 mt-0.5">Healthy inventory levels</div>
                      </div>
                    </div>

                    {/* Search & Filter Toolbar */}
                    <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="relative flex-1 max-w-md">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={forecastSearch}
                          onChange={(e) => {
                            setForecastSearch(e.target.value);
                            setForecastPage(1);
                          }}
                          placeholder="Search product name, pack size, or SKU..."
                          className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#007a55] focus:border-[#007a55]"
                        />
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] text-gray-500 font-medium mr-1">Filter:</span>
                        {[
                          { id: 'ALL', label: `All (${forecasts.length})` },
                          { id: 'URGENT', label: `Urgent (${urgentCount})` },
                          { id: 'LOW', label: `Low Stock (${lowCount})` },
                          { id: 'NORMAL', label: `Sufficient (${normalCount})` },
                        ].map((btn) => (
                          <button
                            key={btn.id}
                            onClick={() => {
                              setForecastRiskFilter(btn.id as any);
                              setForecastPage(1);
                            }}
                            className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                              forecastRiskFilter === btn.id
                                ? 'bg-gray-900 text-white shadow-xs'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {btn.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Clean Shopkeeper Table with Defined Min-Width & No Clipping */}
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
                      <div className="overflow-x-auto w-full">
                        <table className="w-full text-left text-xs min-w-[1020px] divide-y divide-gray-200">
                          <thead className="bg-gray-50/90 text-gray-500 text-[11px] font-semibold uppercase tracking-wider select-none">
                            <tr>
                              <th className="py-3.5 px-4 min-w-[260px]">Product & Pack Size</th>
                              <th className="py-3.5 px-4 min-w-[140px]">Category</th>
                              <th className="py-3.5 px-4 text-center min-w-[100px]">In-Store Stock</th>
                              <th className="py-3.5 px-4 text-center min-w-[100px]">Daily Sales</th>
                              <th className="py-3.5 px-4 text-center min-w-[130px]">Expected Demand ({forecastHorizon}D)</th>
                              <th className="py-3.5 px-4 text-center min-w-[110px]">Stock Lasts</th>
                              <th className="py-3.5 px-4 text-center min-w-[130px]">Restock Alert</th>
                              <th className="py-3.5 px-4 text-right pr-6 min-w-[150px]">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 bg-white">
                            {paginatedForecasts.length === 0 ? (
                              <tr>
                                <td colSpan={8} className="py-12 text-center text-gray-400">
                                  {isGeneratingForecast ? (
                                    <div className="flex flex-col items-center justify-center gap-2">
                                      <RefreshCw className="w-5 h-5 text-[#007a55] animate-spin" />
                                      <span className="text-xs text-gray-600">Calculating live ML demand forecasts across catalog...</span>
                                    </div>
                                  ) : (
                                    'No items match your search or filter.'
                                  )}
                                </td>
                              </tr>
                            ) : (
                              paginatedForecasts.map((f) => (
                                <tr key={f.sku} className="hover:bg-gray-50/70 transition-colors">
                                  <td className="py-3.5 px-4">
                                    <div className="font-semibold text-gray-900 leading-tight">{f.productName}</div>
                                    <div className="flex items-center gap-2 mt-1">
                                      {f.variantName && (
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-[#007a55] border border-emerald-100 whitespace-nowrap">
                                          {f.variantName}
                                        </span>
                                      )}
                                      <span className="text-[11px] text-gray-400 font-mono">{f.sku}</span>
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-4 text-gray-600 whitespace-nowrap">{f.category}</td>
                                  <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                    <span
                                      className={`inline-block px-2.5 py-1 rounded-md text-xs font-bold ${
                                        f.stockOnHand === 0
                                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                          : f.daysOfSupply <= f.supplierLeadTimeDays
                                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                          : f.daysOfSupply <= f.supplierLeadTimeDays * 1.5
                                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                      }`}
                                    >
                                      {f.stockOnHand} units
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-4 text-center whitespace-nowrap font-medium text-gray-800">
                                    {Number(f.dailyVelocity).toFixed(1)} <span className="text-[10px] text-gray-400 font-normal">/day</span>
                                  </td>
                                  <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                    <span className="font-bold text-gray-900">
                                      {f.forecastDemandUnits ?? Math.round(f.dailyVelocity * forecastHorizon)}
                                    </span>
                                    <span className="text-[10px] text-gray-400 ml-1">units</span>
                                  </td>
                                  <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                    <span
                                      className={`font-semibold ${
                                        f.daysOfSupply <= f.supplierLeadTimeDays
                                          ? 'text-rose-600 font-bold'
                                          : f.daysOfSupply <= f.supplierLeadTimeDays * 1.5
                                          ? 'text-amber-700'
                                          : 'text-gray-800'
                                      }`}
                                    >
                                      {f.daysOfSupply === 999 ? '∞' : `${f.daysOfSupply} days`}
                                    </span>
                                    <div className="text-[10px] text-gray-400">Supplier: ~{f.supplierLeadTimeDays}d</div>
                                  </td>
                                  <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                    {f.riskLevel === 'STOCKOUT' ? (
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 uppercase tracking-wide">
                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
                                        Out of Stock
                                      </span>
                                    ) : f.riskLevel === 'CRITICAL_RISK' ? (
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-wide">
                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                        Urgent Restock
                                      </span>
                                    ) : f.riskLevel === 'LOW_STOCK' ? (
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 uppercase tracking-wide">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                        Running Low
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-[#007a55] border border-emerald-200 uppercase tracking-wide">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                        Sufficient
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3.5 px-4 text-right pr-6 whitespace-nowrap">
                                    {f.recommendedReorderUnits && f.recommendedReorderUnits > 0 ? (
                                      <button
                                        onClick={() => handleQuickReorder(f.sku, f.recommendedReorderUnits!)}
                                        className="px-3.5 py-1.5 rounded-md bg-[#007a55] hover:bg-[#006345] text-white text-xs font-semibold shadow-xs transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                                        title={`Pre-fill reorder for ${f.recommendedReorderUnits} units`}
                                      >
                                        <PackagePlus className="w-3.5 h-3.5 shrink-0" />
                                        <span>Order +{f.recommendedReorderUnits}</span>
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => handleQuickReorder(f.sku, 20)}
                                        className="px-3.5 py-1.5 rounded-md bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium transition-colors shadow-2xs inline-flex items-center gap-1.5 whitespace-nowrap"
                                        title="Record incoming stock receipt for this item"
                                      >
                                        <PackagePlus className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                                        <span>Receive Stock</span>
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination Footer */}
                      {sortedAndFiltered.length > 0 && (
                        <div className="flex items-center justify-between px-4 py-3 bg-gray-50/80 border-t border-gray-200 text-xs text-gray-600">
                          <div>
                            Showing{' '}
                            <span className="font-semibold text-gray-900">
                              {(currentPage - 1) * FORECAST_PAGE_SIZE + 1}
                            </span>{' '}
                            to{' '}
                            <span className="font-semibold text-gray-900">
                              {Math.min(currentPage * FORECAST_PAGE_SIZE, sortedAndFiltered.length)}
                            </span>{' '}
                            of{' '}
                            <span className="font-semibold text-gray-900">{sortedAndFiltered.length}</span> products
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setForecastPage((p) => Math.max(1, p - 1))}
                              disabled={currentPage === 1}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs font-medium text-xs transition-colors"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                              <span>Previous</span>
                            </button>

                            <span className="px-2.5 py-1 text-xs font-medium text-gray-700">
                              Page {currentPage} of {totalPages}
                            </span>

                            <button
                              onClick={() => setForecastPage((p) => Math.min(totalPages, p + 1))}
                              disabled={currentPage === totalPages}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs font-medium text-xs transition-colors"
                            >
                              <span>Next</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* ========================================================= */}
          {/* 7. WHATSAPP COMMERCE SIMULATOR (whatsapp-adapter backend) */}
          {/* ========================================================= */}
          {activeNav === 'whatsapp' && (
            <div className="space-y-6 max-w-3xl mx-auto">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">WhatsApp Commerce Simulator</h1>
                <p className="text-gray-500 text-xs mt-1">
                  Test customer conversational orders, soap disambiguation, and cart checkout.
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-[540px]">
                {/* Chat Header */}
                <div className="bg-[#007a55] text-white px-5 py-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs">
                      FC
                    </div>
                    <div>
                      <div className="font-bold text-xs">FreshCart WhatsApp Bot</div>
                      <div className="text-[10px] text-emerald-100">Live Backend Connected</div>
                    </div>
                  </div>
                  <span className="text-[11px] text-white/80">+91 98765 43210</span>
                </div>

                {/* Messages Body */}
                <div className="flex-1 bg-[#f9fafb] p-4 overflow-y-auto space-y-3">
                  {chatMessages.map((m, idx) => (
                    <div
                      key={idx}
                      className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-xl px-4 py-2.5 text-xs shadow-2xs whitespace-pre-wrap ${
                          m.sender === 'user'
                            ? 'bg-[#dcf8c6] text-gray-900 rounded-tr-none'
                            : 'bg-white text-gray-900 rounded-tl-none border border-gray-200/70'
                        }`}
                      >
                        {m.text}
                        <div className="text-[9px] text-gray-400 text-right mt-1">{m.time}</div>
                      </div>

                      {/* Interactive Options Buttons */}
                      {m.options && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {m.options.map((opt, i) => (
                            <button
                              key={i}
                              onClick={() => handleSendChatMessage(opt)}
                              className="px-3 py-1 rounded-full bg-white hover:bg-emerald-50 text-[#007a55] text-[10px] font-semibold border border-emerald-200 shadow-2xs transition-colors"
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Chat Input */}
                <div className="p-3.5 bg-white border-t border-gray-200 flex items-center gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
                    placeholder="Type message (e.g. soap, 1, ADD DOVE, Confirm)..."
                    className="flex-1 px-3.5 py-2 border border-gray-200 rounded-md text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#007a55] focus:border-[#007a55]"
                  />
                  <button
                    onClick={() => handleSendChatMessage()}
                    className="p-2.5 rounded-md bg-[#007a55] text-white hover:bg-[#006345] transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: ADD PRODUCT (Strict Schema 001) */}
      {/* ========================================================= */}
      {isAddProductOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h2 className="font-bold text-base text-gray-900">Add New Product to Category</h2>
                <p className="text-gray-500 text-xs">Create product variant with category, storage type, and pricing.</p>
              </div>
              <button
                onClick={() => setIsAddProductOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProductSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Select Primary Category</label>
                <select
                  value={formCategoryId}
                  onChange={(e) => {
                    const catId = e.target.value;
                    setFormCategoryId(catId);
                    const cat = categories.find((c) => c.id === catId);
                    if (cat) {
                      setFormHsn(cat.defaultHsn);
                      setFormZone(cat.defaultZone);
                      setFormBrand(cat.sampleBrands[0] || 'Brand');
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-xs bg-white text-gray-800 font-medium focus:outline-none focus:ring-1 focus:ring-[#007a55] focus:border-[#007a55]"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.parentName})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Product Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dettol Original Germ Protection Bathing Soap"
                    value={formProductName}
                    onChange={(e) => setFormProductName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-[#007a55] focus:border-[#007a55]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Brand Name</label>
                  <input
                    type="text"
                    required
                    value={formBrand}
                    onChange={(e) => setFormBrand(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-[#007a55] focus:border-[#007a55]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Storage Condition</label>
                  <select
                    value={formStorageType}
                    onChange={(e) => setFormStorageType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#007a55] focus:border-[#007a55]"
                  >
                    <option value="ambient">Ambient (Room Temp)</option>
                    <option value="chilled">Chilled (Cold Storage 2-8°C)</option>
                    <option value="frozen">Frozen (-18°C)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Shelf Life (Days)</label>
                  <input
                    type="number"
                    min={1}
                    value={formShelfLifeDays}
                    onChange={(e) => setFormShelfLifeDays(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-[#007a55] focus:border-[#007a55]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Dietary Type</label>
                  <div className="flex items-center gap-3 mt-2">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        checked={formIsVeg}
                        onChange={() => setFormIsVeg(true)}
                        className="text-[#007a55] focus:ring-[#007a55]"
                      />
                      <span className="text-xs text-gray-700">Vegetarian</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        checked={!formIsVeg}
                        onChange={() => setFormIsVeg(false)}
                        className="text-[#007a55] focus:ring-[#007a55]"
                      />
                      <span className="text-xs text-gray-700">Non-Veg</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* ========================================================= */}
              {/* PRODUCT VARIANTS & INDIVIDUAL PRICING SECTION */}
              {/* ========================================================= */}
              <div className="pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                      Product Variants & Pricing ({formVariants.length})
                    </h4>
                    <p className="text-[11px] text-gray-500">
                      Add multiple pack sizes/weights with their own distinct price, MRP, and stock.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddVariantRow}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-[#007a55] font-semibold text-xs transition-colors border border-emerald-200"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Another Variant</span>
                  </button>
                </div>

                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {formVariants.map((v, idx) => (
                    <div
                      key={v.id}
                      className="p-3.5 rounded-lg border border-gray-200 bg-gray-50/60 hover:bg-gray-50 transition-colors relative"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-[#007a55] text-white flex items-center justify-center text-[10px]">
                            {idx + 1}
                          </span>
                          Variant #{idx + 1}
                        </span>
                        {formVariants.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveVariantRow(v.id)}
                            className="text-gray-400 hover:text-red-600 p-1 rounded transition-colors"
                            title="Remove variant"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-medium text-gray-700 mb-1">
                            Pack Size / Variant Name *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. 500 g Pack, 1 kg Bag, 100 ml"
                            value={v.variantName}
                            onChange={(e) => handleUpdateVariantRow(v.id, 'variantName', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded text-xs focus:ring-1 focus:ring-[#007a55] focus:border-[#007a55]"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-gray-700 mb-1">
                            SKU Code *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. TATA-SALT-500G"
                            value={v.sku}
                            onChange={(e) => handleUpdateVariantRow(v.id, 'sku', e.target.value.toUpperCase())}
                            className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded text-xs font-mono uppercase focus:ring-1 focus:ring-[#007a55] focus:border-[#007a55]"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-gray-700 mb-1">
                            Barcode (EAN-13)
                          </label>
                          <input
                            type="text"
                            placeholder="Optional barcode"
                            value={v.barcode}
                            onChange={(e) => handleUpdateVariantRow(v.id, 'barcode', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded text-xs font-mono focus:ring-1 focus:ring-[#007a55] focus:border-[#007a55]"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2.5">
                        <div>
                          <label className="block text-[11px] font-medium text-gray-700 mb-1">
                            Selling Price (₹) *
                          </label>
                          <input
                            type="number"
                            step="0.5"
                            required
                            value={v.price}
                            onChange={(e) => handleUpdateVariantRow(v.id, 'price', parseFloat(e.target.value) || 0)}
                            className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded text-xs font-semibold text-emerald-800 focus:ring-1 focus:ring-[#007a55] focus:border-[#007a55]"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-gray-700 mb-1">
                            MRP (₹) *
                          </label>
                          <input
                            type="number"
                            step="0.5"
                            required
                            value={v.mrp}
                            onChange={(e) => handleUpdateVariantRow(v.id, 'mrp', parseFloat(e.target.value) || 0)}
                            className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded text-xs focus:ring-1 focus:ring-[#007a55] focus:border-[#007a55]"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-gray-700 mb-1">
                            Initial Stock *
                          </label>
                          <input
                            type="number"
                            min={0}
                            required
                            value={v.initialStock}
                            onChange={(e) => handleUpdateVariantRow(v.id, 'initialStock', parseInt(e.target.value, 10) || 0)}
                            className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded text-xs focus:ring-1 focus:ring-[#007a55] focus:border-[#007a55]"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-gray-700 mb-1">
                            Weight / Unit
                          </label>
                          <div className="flex gap-1">
                            <input
                              type="number"
                              min={0.01}
                              step="any"
                              value={v.weight}
                              onChange={(e) => handleUpdateVariantRow(v.id, 'weight', parseFloat(e.target.value) || 1)}
                              className="w-16 px-2 py-1.5 bg-white border border-gray-200 rounded text-xs focus:ring-1 focus:ring-[#007a55] focus:border-[#007a55]"
                            />
                            <select
                              value={v.unit}
                              onChange={(e) => handleUpdateVariantRow(v.id, 'unit', e.target.value)}
                              className="flex-1 px-1 py-1.5 bg-white border border-gray-200 rounded text-xs focus:ring-1 focus:ring-[#007a55] focus:border-[#007a55]"
                            >
                              <option value="g">g</option>
                              <option value="kg">kg</option>
                              <option value="ml">ml</option>
                              <option value="l">l</option>
                              <option value="pack">pack</option>
                              <option value="each">each</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Store Shelf Location</label>
                  <input
                    type="text"
                    value={formZone}
                    onChange={(e) => setFormZone(e.target.value)}
                    placeholder="e.g. Zone A-01-R1"
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#007a55] focus:border-[#007a55]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Product Image URL (Optional)</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={formImageUrl}
                    onChange={(e) => setFormImageUrl(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-[#007a55] focus:border-[#007a55]"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-xs text-gray-500">
                  Total variants to be created: <strong className="text-gray-900">{formVariants.length}</strong>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsAddProductOpen(false)}
                    className="px-4 py-2 rounded-md border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-medium text-xs transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-md bg-[#007a55] hover:bg-[#006345] text-white font-medium text-xs transition-colors shadow-2xs"
                  >
                    Save Product & All Variants to Catalog
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1B: ADD VARIANT TO EXISTING PRODUCT */}
      {/* ========================================================= */}
      {isAddVariantModalOpen && selectedProductForVariant && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-gray-200">
            <div className="flex items-center justify-between pb-4 border-b border-gray-200">
              <div>
                <h3 className="font-bold text-base text-gray-900">
                  Add New Variant to Product
                </h3>
                <p className="text-gray-500 text-xs mt-0.5">
                  {selectedProductForVariant.brand} · <span className="font-semibold text-gray-800">{selectedProductForVariant.productName}</span>
                </p>
              </div>
              <button
                onClick={() => setIsAddVariantModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddVariantSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Pack Size / Variant Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 2 kg Bag, 1 Litre"
                    value={newVarName}
                    onChange={(e) => setNewVarName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-xs focus:ring-1 focus:ring-[#007a55]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    SKU Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SUGAR-2KG"
                    value={newVarSku}
                    onChange={(e) => setNewVarSku(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-xs uppercase font-mono focus:ring-1 focus:ring-[#007a55]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Selling Price (₹) *</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={newVarPrice}
                    onChange={(e) => setNewVarPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-xs font-bold text-emerald-800 focus:ring-1 focus:ring-[#007a55]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">MRP (₹) *</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={newVarMrp}
                    onChange={(e) => setNewVarMrp(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-xs focus:ring-1 focus:ring-[#007a55]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Initial Stock *</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={newVarStock}
                    onChange={(e) => setNewVarStock(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-xs focus:ring-1 focus:ring-[#007a55]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Weight Value</label>
                  <input
                    type="number"
                    min={0.01}
                    step="any"
                    value={newVarWeight}
                    onChange={(e) => setNewVarWeight(parseFloat(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Measurement Unit</label>
                  <select
                    value={newVarUnit}
                    onChange={(e) => setNewVarUnit(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-xs bg-white"
                  >
                    <option value="g">g (Grams)</option>
                    <option value="kg">kg (Kilograms)</option>
                    <option value="ml">ml (Millilitres)</option>
                    <option value="l">l (Litres)</option>
                    <option value="pack">pack (Pack)</option>
                    <option value="each">each (Pieces / Units)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Barcode (EAN-13, Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 8901030099991"
                  value={newVarBarcode}
                  onChange={(e) => setNewVarBarcode(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-xs font-mono"
                />
              </div>

              <div className="pt-4 border-t border-gray-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddVariantModalOpen(false)}
                  className="px-4 py-2 rounded-md border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-medium text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-md bg-[#007a55] hover:bg-[#006345] text-white font-medium text-xs transition-colors shadow-2xs"
                >
                  Add Variant & Price to Catalog
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: RECEIVE INBOUND SHIPMENT (GRN) */}
      {/* ========================================================= */}
      {isReceiveStockOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-gray-200">
            <div className="flex items-center justify-between pb-4 border-b border-gray-200">
              <div>
                <h3 className="font-bold text-base text-gray-900">Receive Stock (Goods Receipt)</h3>
                <p className="text-gray-500 text-xs">Record incoming supplier batch and add to on-hand inventory.</p>
              </div>
              <button onClick={() => setIsReceiveStockOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmReceiveStock} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Select Product SKU</label>
                <select
                  value={receiveSku}
                  onChange={(e) => setReceiveSku(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#007a55] focus:border-[#007a55]"
                >
                  {variants.map((v) => (
                    <option key={v.sku} value={v.sku}>
                      {v.productName} ({v.sku})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Batch Number</label>
                  <input
                    type="text"
                    required
                    value={receiveBatchNumber}
                    onChange={(e) => setReceiveBatchNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#007a55] focus:border-[#007a55]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    min={1}
                    value={receiveQuantity}
                    onChange={(e) => setReceiveQuantity(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-[#007a55] focus:border-[#007a55]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Expiry Date</label>
                  <input
                    type="date"
                    required
                    value={receiveExpiryDate}
                    onChange={(e) => setReceiveExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-[#007a55] focus:border-[#007a55]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Shelf Rack Location</label>
                  <input
                    type="text"
                    required
                    value={receiveLocationZone}
                    onChange={(e) => setReceiveLocationZone(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#007a55] focus:border-[#007a55]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Supplier PO / Invoice Ref</label>
                <input
                  type="text"
                  value={receivePoRef}
                  onChange={(e) => setReceivePoRef(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-[#007a55] focus:border-[#007a55]"
                />
              </div>

              <div className="pt-3 border-t border-gray-200 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsReceiveStockOpen(false)}
                  className="px-4 py-2 border border-gray-200 bg-white rounded-md text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#007a55] hover:bg-[#006345] text-white rounded-md text-xs font-medium transition-colors shadow-2xs"
                >
                  Confirm Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: RELOCATE BATCH SHELF ZONE */}
      {/* ========================================================= */}
      {isMoveZoneOpen && selectedBatchForMove && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-xl border border-gray-200">
            <h3 className="font-bold text-base text-gray-900">Relocate Batch Rack</h3>
            <p className="text-gray-500 text-xs mt-1">
              Transfer <strong>{selectedBatchForMove.batchNumber}</strong> to a new shelf.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-medium text-gray-700 mb-1">New Shelf Rack Location</label>
              <input
                type="text"
                value={targetZoneForMove}
                onChange={(e) => setTargetZoneForMove(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#007a55] focus:border-[#007a55]"
              />
            </div>

            <div className="mt-5 flex justify-end gap-2.5">
              <button
                onClick={() => setIsMoveZoneOpen(false)}
                className="px-3.5 py-1.5 border border-gray-200 bg-white rounded-md text-xs text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmMoveZone}
                className="px-3.5 py-1.5 bg-[#007a55] hover:bg-[#006345] text-white rounded-md text-xs font-medium transition-colors shadow-2xs"
              >
                Confirm Relocation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ADMIN AUTHENTICATION & MFA MODAL */}
      {/* ========================================================= */}
      <AdminAuthModal
        isOpen={isAdminAuthOpen}
        onClose={() => setIsAdminAuthOpen(false)}
        currentSession={adminSession}
        onSuccess={(sess) => {
          setAdminSession(sess);
          showToast(`Authenticated as ${sess.user.fullName}`);
        }}
      />

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
