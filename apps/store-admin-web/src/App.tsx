import React, { useState } from 'react';
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
  status: 'CONFIRMED' | 'PACKED' | 'OUT_FOR_DELIVERY' | 'DELIVERED';
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

export interface DemandForecast {
  sku: string;
  productName: string;
  category: string;
  dailyVelocity: number;
  stockOnHand: number;
  daysOfSupply: number;
  supplierLeadTimeDays: number;
  riskLevel: 'NORMAL' | 'LOW_STOCK' | 'CRITICAL_RISK' | 'STOCKOUT';
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
  const [invoices] = useState<InvoiceRecord[]>(INITIAL_INVOICES);
  const [forecasts] = useState<DemandForecast[]>(INITIAL_FORECASTS);

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

  // Add Product form state (conforming to Schema 001)
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

  // Receive Inbound Stock (GRN) state
  const [receiveSku, setReceiveSku] = useState(INITIAL_VARIANTS[0].sku);
  const [receiveBatchNumber, setReceiveBatchNumber] = useState('BATCH-2026-INB-101');
  const [receiveQuantity, setReceiveQuantity] = useState(30);
  const [receiveExpiryDate, setReceiveExpiryDate] = useState('2027-08-30');
  const [receiveLocationZone, setReceiveLocationZone] = useState('Zone A-01-R1');
  const [receivePoRef, setReceivePoRef] = useState('PO-INB-7890');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const getCardQty = (sku: string) => {
    return cardQuantities[sku] !== undefined ? cardQuantities[sku] : 10;
  };

  const handleCardQtyChange = (sku: string, val: number) => {
    setCardQuantities((prev) => ({
      ...prev,
      [sku]: Math.max(1, isNaN(val) ? 1 : val),
    }));
  };

  // 1. Live stock adjustment (+ Add / – Remove)
  const handleStockAdjustment = async (sku: string, delta: number) => {
    const current = variants.find((v) => v.sku === sku);
    if (!current) return;

    const available = current.stock - current.reserved;
    if (delta < 0 && available + delta < 0) {
      showToast(`Cannot remove ${Math.abs(delta)} units. Only ${available} available.`);
      return;
    }

    const newStock = Math.max(current.reserved, current.stock + delta);

    // Call inventory microservice
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

    // Record in audit ledger
    const newMovement: StockMovement = {
      id: `mvt-${Date.now()}`,
      sku,
      productName: current.productName,
      delta,
      balanceAfter: newStock,
      reason: delta > 0 ? 'RESTOCK_RECEIVED' : 'MANUAL_COUNT_ADJUSTMENT',
      locationZone: current.zone,
      referenceId: 'MANUAL_CARD_ADJUST',
      actor: 'Store Admin',
      timestamp: 'Just now',
    };
    setStockMovements((prev) => [newMovement, ...prev]);

    const newAvail = newStock - current.reserved;
    if (delta > 0) {
      showToast(`Added ${delta} units to ${current.productName} (${newAvail} available now)`);
    } else {
      showToast(`Removed ${Math.abs(delta)} units from ${current.productName} (${newAvail} available now)`);
    }
  };

  // 2. Inbound Stock Receipt (GRN)
  const handleConfirmReceiveStock = (e: React.FormEvent) => {
    e.preventDefault();
    const targetVariant = variants.find((v) => v.sku === receiveSku);
    if (!targetVariant) return;

    const qty = Number(receiveQuantity);

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

    setIsReceiveStockOpen(false);
    showToast(`Received ${qty} units of ${targetVariant.productName} into batch ${receiveBatchNumber}`);
    setReceiveBatchNumber(`BATCH-2026-INB-${Math.floor(100 + Math.random() * 900)}`);
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

  // 6. Create Product (Catalog Service)
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

    // Save to catalog service
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

    setFormProductName('');
    setFormSku('');
    setFormBarcode('');
    setFormImageUrl('');
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
  const handleUpdateOrderStatus = (orderId: string, nextStatus: OrderRecord['status']) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o))
    );
    showToast(`Order status updated to ${nextStatus.replace('_', ' ')}`);
  };

  // 9. Substitution response
  const handleRespondSubstitution = (taskId: string, decision: 'ACCEPTED' | 'REJECTED') => {
    setPickTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, substituteDecision: decision, status: 'PICKED' } : t))
    );
    showToast(`Customer ${decision.toLowerCase()} substitution proposal`);
  };

  // 10. WhatsApp Chat Simulator Send
  const handleSendChatMessage = (textToSend?: string) => {
    const txt = textToSend || chatInput;
    if (!txt.trim()) return;

    const newMsgs = [
      ...chatMessages,
      { sender: 'user' as const, text: txt, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
    ];
    setChatMessages(newMsgs);
    setChatInput('');

    setTimeout(() => {
      const lower = txt.toLowerCase();
      let reply = '';
      let opts: string[] | undefined = undefined;

      if (lower.includes('soap')) {
        reply = 'We carry 3 categories of soap products:\n1. Bathing Soaps\n2. Laundry Bars\n3. Dishwash Bars\n\nWhich one would you like?';
        opts = ['1. Bathing Soaps', '2. Laundry Bars', '3. Dishwash Bars'];
      } else if (lower.includes('bathing') || lower === '1') {
        reply = '🛁 Bathing Soaps in stock:\n• Dettol Original (75g) — ₹38.00\n• Dove Cream Beauty (4 × 125g) — ₹295.00 [Only 1 left!]\n\nReply "ADD DETTOL" to add to cart.';
        opts = ['ADD DETTOL', 'ADD DOVE'];
      } else if (lower.includes('add dettol')) {
        reply = '✅ Added 1× Dettol Original (75g) to cart!\nSubtotal: ₹38.00 | Tax: ₹6.84 | Delivery: ₹20.00\nTotal: ₹64.84\n\nReply "CHECKOUT" to place order.';
        opts = ['CHECKOUT'];
      } else if (lower.includes('checkout')) {
        reply = '🎉 Order Confirmed! (ORD-992144-881)\nDelivery to Sector 2, HSR Layout within 25 minutes.';
      } else {
        reply = 'I can help you browse groceries and place orders. Try typing "soap", "milk", or "atta".';
      }

      setChatMessages((prev) => [
        ...prev,
        { sender: 'bot', text: reply, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), options: opts },
      ]);
    }, 600);
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
      : variants.filter((v) => v.categoryId === catalogCategoryFilter);

  const totalPhysicalUnits = variants.reduce((acc, v) => acc + v.stock, 0);
  const totalReservedUnits = variants.reduce((acc, v) => acc + v.reserved, 0);
  const totalAvailableUnits = totalPhysicalUnits - totalReservedUnits;

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col font-sans antialiased text-gray-800 text-xs">
      {/* ========================================================= */}
      {/* TOP HEADER: Clean Seller Hub Header */}
      {/* ========================================================= */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <span className="text-base font-bold text-gray-900 tracking-tight">Seller hub</span>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="http://localhost:5173"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#047857] hover:bg-[#065f46] text-white font-medium text-xs transition-colors shadow-xs"
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
        <aside className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0 py-3">
          <nav className="space-y-0.5 px-2">
            <button
              onClick={() => setActiveNav('inventory')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs font-medium transition-colors ${
                activeNav === 'inventory'
                  ? 'bg-gray-100 text-gray-900 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Boxes className="w-4 h-4 text-emerald-700" />
                <span>Inventory</span>
              </div>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-gray-200 text-gray-700">
                {variants.length}
              </span>
            </button>

            <button
              onClick={() => setActiveNav('catalog')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs font-medium transition-colors ${
                activeNav === 'catalog'
                  ? 'bg-gray-100 text-gray-900 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <LayoutGrid className="w-4 h-4 text-emerald-700" />
              <span>Products & Categories</span>
            </button>

            <button
              onClick={() => setActiveNav('orders')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs font-medium transition-colors ${
                activeNav === 'orders'
                  ? 'bg-gray-100 text-gray-900 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ShoppingCart className="w-4 h-4 text-emerald-700" />
                <span>Customer Orders</span>
              </div>
              {orders.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  {orders.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveNav('fulfillment')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs font-medium transition-colors ${
                activeNav === 'fulfillment'
                  ? 'bg-gray-100 text-gray-900 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Truck className="w-4 h-4 text-emerald-700" />
              <span>Fulfillment & Packing</span>
            </button>

            <button
              onClick={() => setActiveNav('invoices')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs font-medium transition-colors ${
                activeNav === 'invoices'
                  ? 'bg-gray-100 text-gray-900 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Receipt className="w-4 h-4 text-emerald-700" />
              <span>Tax Invoices & GST</span>
            </button>

            <button
              onClick={() => setActiveNav('analytics')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs font-medium transition-colors ${
                activeNav === 'analytics'
                  ? 'bg-gray-100 text-gray-900 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <TrendingUp className="w-4 h-4 text-emerald-700" />
              <span>Stock Demand & Alerts</span>
            </button>

            <button
              onClick={() => setActiveNav('whatsapp')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs font-medium transition-colors ${
                activeNav === 'whatsapp'
                  ? 'bg-gray-100 text-gray-900 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <MessageSquare className="w-4 h-4 text-emerald-700" />
                <span>WhatsApp Commerce</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </button>
          </nav>
        </aside>

        {/* MAIN DISPLAY AREA */}
        <main className="flex-1 p-6 overflow-y-auto">
          {/* ========================================================= */}
          {/* 1. INVENTORY MODULE (Real inventory-service backend) */}
          {/* ========================================================= */}
          {activeNav === 'inventory' && (
            <div className="space-y-5 max-w-7xl mx-auto">
              {/* Header: Title + Primary Actions */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold text-gray-900 tracking-tight">
                    Inventory ({variants.length})
                  </h1>
                  <p className="text-gray-500 text-xs mt-0.5">
                    On-hand, reserved, and available stock per product.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsReceiveStockOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#047857] hover:bg-[#065f46] text-white font-medium text-xs transition-colors shadow-xs"
                  >
                    <PackagePlus className="w-3.5 h-3.5" />
                    <span>+ Receive Stock</span>
                  </button>

                  <button
                    onClick={handleTriggerTtlSweep}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-medium transition-colors shadow-2xs"
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
                  className={`pb-2 transition-colors ${
                    inventoryViewMode === 'cards'
                      ? 'border-b-2 border-emerald-700 text-emerald-800 font-bold'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  Product Stock Cards ({variants.length})
                </button>

                <button
                  onClick={() => setInventoryViewMode('batches')}
                  className={`pb-2 transition-colors ${
                    inventoryViewMode === 'batches'
                      ? 'border-b-2 border-emerald-700 text-emerald-800 font-bold'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  FEFO Batches & Racks ({fefoBatches.length})
                </button>

                <button
                  onClick={() => setInventoryViewMode('holds')}
                  className={`pb-2 transition-colors ${
                    inventoryViewMode === 'holds'
                      ? 'border-b-2 border-emerald-700 text-emerald-800 font-bold'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  Active 15-Minute Holds ({reservations.length})
                </button>

                <button
                  onClick={() => setInventoryViewMode('ledger')}
                  className={`pb-2 transition-colors ${
                    inventoryViewMode === 'ledger'
                      ? 'border-b-2 border-emerald-700 text-emerald-800 font-bold'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  Stock Movement Ledger ({stockMovements.length})
                </button>
              </div>

              {/* SUBVIEW 1: PRODUCT STOCK CARDS (MATCHING REFERENCE IMAGE) */}
              {inventoryViewMode === 'cards' && (
                <div className="space-y-4">
                  {/* Search and Filter Pills */}
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
                          {/* Card Header: Thumbnail, Name, SKU, Status Pill */}
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

                            {/* Status Pill Badge */}
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

                          {/* Card Middle: Units Available & Breakdown */}
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <div className="text-sm font-bold text-gray-900">
                              {available} units available
                            </div>
                            <div className="text-[11px] text-gray-400 mt-0.5 font-normal">
                              {item.stock} on hand · {item.reserved} reserved
                            </div>
                          </div>

                          {/* Card Bottom: [ 10 ] [ + Add ] [ - Remove ] */}
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
            <div className="space-y-5 max-w-7xl mx-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-gray-900 tracking-tight">Product Catalog & Categories</h1>
                  <p className="text-gray-500 text-xs mt-0.5">
                    Hierarchical category structure with 3-category soap disambiguation & multi-variant pack sizes.
                  </p>
                </div>

                <button
                  onClick={() => setIsAddProductOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#047857] hover:bg-[#065f46] text-white font-medium text-xs transition-colors shadow-xs"
                >
                  <PackagePlus className="w-4 h-4" />
                  <span>+ Add Product to Category</span>
                </button>
              </div>

              {/* Requirement #1: 3-Category Soap Disambiguation Banner */}
              <div className="bg-white border border-emerald-200 rounded-xl p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-700" />
                    <span className="font-bold text-gray-900 text-xs">
                      Requirement #1: Soap Disambiguation
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Live Catalog Disambiguation
                  </span>
                </div>

                <p className="text-gray-600 text-xs">
                  When a customer searches for <strong>"soap"</strong> on the storefront or WhatsApp, the system automatically resolves the query into three distinct categories:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div
                    onClick={() => setCatalogCategoryFilter('11000000-0000-0000-0000-000000000001')}
                    className="p-3 bg-gray-50 rounded-lg border border-gray-200 cursor-pointer hover:border-emerald-600 hover:bg-emerald-50/40 transition-colors"
                  >
                    <div className="font-bold text-gray-900 text-xs flex justify-between">
                      <span>1. Bathing Soaps</span>
                      <span className="text-emerald-700 font-medium text-[10px]">Filter →</span>
                    </div>
                    <div className="text-[11px] text-gray-500 mt-1">
                      Brands: Dettol, Dove, Lifebuoy, Pears
                    </div>
                  </div>

                  <div
                    onClick={() => setCatalogCategoryFilter('11000000-0000-0000-0000-000000000002')}
                    className="p-3 bg-gray-50 rounded-lg border border-gray-200 cursor-pointer hover:border-emerald-600 hover:bg-emerald-50/40 transition-colors"
                  >
                    <div className="font-bold text-gray-900 text-xs flex justify-between">
                      <span>2. Washing Detergent Bars</span>
                      <span className="text-emerald-700 font-medium text-[10px]">Filter →</span>
                    </div>
                    <div className="text-[11px] text-gray-500 mt-1">
                      Brands: Surf Excel, Rin, Tide
                    </div>
                  </div>

                  <div
                    onClick={() => setCatalogCategoryFilter('11000000-0000-0000-0000-000000000003')}
                    className="p-3 bg-gray-50 rounded-lg border border-gray-200 cursor-pointer hover:border-emerald-600 hover:bg-emerald-50/40 transition-colors"
                  >
                    <div className="font-bold text-gray-900 text-xs flex justify-between">
                      <span>3. Dishwashing Soaps</span>
                      <span className="text-emerald-700 font-medium text-[10px]">Filter →</span>
                    </div>
                    <div className="text-[11px] text-gray-500 mt-1">
                      Brands: Vim, Pril, Exo
                    </div>
                  </div>
                </div>

                {/* Disambiguation Query Tester */}
                <div className="pt-2 flex items-center gap-2">
                  <input
                    type="text"
                    value={disambiguateTerm}
                    onChange={(e) => setDisambiguateTerm(e.target.value)}
                    placeholder="Enter search term (e.g. soap, detergent)"
                    className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:border-emerald-600"
                  />
                  <button
                    onClick={() => handleRunDisambiguation(disambiguateTerm)}
                    className="px-3.5 py-1.5 rounded-lg bg-gray-900 text-white font-medium text-xs hover:bg-black transition-colors"
                  >
                    Test Disambiguation
                  </button>
                </div>
              </div>

              {/* Master Products Table */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="p-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-700">Filter Category:</span>
                    <select
                      value={catalogCategoryFilter}
                      onChange={(e) => setCatalogCategoryFilter(e.target.value)}
                      className="px-2 py-1 text-xs border border-gray-200 rounded-lg bg-white"
                    >
                      <option value="ALL">All Categories</option>
                      {MASTER_CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <span className="text-gray-500 text-xs">{catalogVariants.length} products</span>
                </div>

                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50/50 text-gray-500 border-b border-gray-200 font-medium">
                    <tr>
                      <th className="py-3 px-4">Product Name</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Pack Size</th>
                      <th className="py-3 px-4">MRP / Price</th>
                      <th className="py-3 px-4">Rack Zone</th>
                      <th className="py-3 px-4 text-right">Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {catalogVariants.map((p) => (
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
                        <td className="py-3 px-4 font-mono text-gray-600">{p.zone}</td>
                        <td className="py-3 px-4 text-right font-bold text-gray-900">{p.stock} units</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 3. CUSTOMER ORDERS MODULE (order-service backend) */}
          {/* ========================================================= */}
          {activeNav === 'orders' && (
            <div className="space-y-5 max-w-7xl mx-auto">
              <div>
                <h1 className="text-xl font-bold text-gray-900 tracking-tight">Customer Orders</h1>
                <p className="text-gray-500 text-xs mt-0.5">
                  Track and fulfill customer orders from Web and WhatsApp channels.
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
                        <div className="text-[11px] font-medium text-gray-500 mb-1">Items Ordered:</div>
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
            <div className="space-y-5 max-w-7xl mx-auto">
              <div>
                <h1 className="text-xl font-bold text-gray-900 tracking-tight">Order Fulfillment & Pick Lists</h1>
                <p className="text-gray-500 text-xs mt-0.5">
                  Organized by dark store shelf zones with customer substitution approval flow.
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50/50 text-gray-500 border-b border-gray-200 font-medium">
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
                        <td className="py-3 px-4 font-semibold text-gray-900">{t.orderNumber}</td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-gray-800">{t.productName}</div>
                          <div className="text-[11px] text-gray-400 font-mono">{t.sku}</div>
                        </td>
                        <td className="py-3 px-4 text-gray-600 font-mono">{t.zone}</td>
                        <td className="py-3 px-4 font-bold text-gray-900">{t.quantity}</td>
                        <td className="py-3 px-4">
                          {t.status === 'SUBSTITUTION_PROPOSED' ? (
                            <div>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                Substitute Proposed: {t.substituteName}
                              </span>
                              <div className="text-[10px] text-gray-400 mt-0.5">Awaiting customer approval</div>
                            </div>
                          ) : (
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                t.status === 'PICKED'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {t.status}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {t.status === 'SUBSTITUTION_PROPOSED' && t.substituteDecision === 'PENDING' && (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleRespondSubstitution(t.id, 'ACCEPTED')}
                                className="px-2 py-1 rounded bg-[#047857] text-white text-[10px] font-medium hover:bg-[#065f46]"
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => handleRespondSubstitution(t.id, 'REJECTED')}
                                className="px-2 py-1 rounded bg-rose-50 text-rose-700 text-[10px] font-medium hover:bg-rose-100"
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
            <div className="space-y-5 max-w-7xl mx-auto">
              <div>
                <h1 className="text-xl font-bold text-gray-900 tracking-tight">Tax Invoices & GST</h1>
                <p className="text-gray-500 text-xs mt-0.5">
                  Tax invoices with HSN, CGST (9% / 2.5%), SGST (9% / 2.5%) breakdown.
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50/50 text-gray-500 border-b border-gray-200 font-medium">
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
                        <td className="py-3 px-4 font-mono font-semibold text-gray-900">{inv.invoiceNumber}</td>
                        <td className="py-3 px-4 text-gray-600">{inv.orderNumber}</td>
                        <td className="py-3 px-4 text-gray-800">{inv.customerName}</td>
                        <td className="py-3 px-4 text-gray-800">₹{inv.taxableAmount.toFixed(2)}</td>
                        <td className="py-3 px-4 text-emerald-700 font-medium">₹{inv.totalTax.toFixed(2)}</td>
                        <td className="py-3 px-4 font-bold text-gray-900">₹{inv.grandTotal.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => window.print()}
                            className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium inline-flex items-center gap-1"
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
          {/* 6. STOCK DEMAND & REORDER ALERTS (inventory-service analytics) */}
          {/* ========================================================= */}
          {activeNav === 'analytics' && (
            <div className="space-y-5 max-w-7xl mx-auto">
              <div>
                <h1 className="text-xl font-bold text-gray-900 tracking-tight">Stock Demand & Reorder Alerts</h1>
                <p className="text-gray-500 text-xs mt-0.5">
                  Daily sales velocity, days of supply remaining, and automated reorder alerts.
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50/50 text-gray-500 border-b border-gray-200 font-medium">
                    <tr>
                      <th className="py-3 px-4">Product Name / SKU</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Daily Sales Velocity</th>
                      <th className="py-3 px-4">Stock on Hand</th>
                      <th className="py-3 px-4">Days of Supply</th>
                      <th className="py-3 px-4">Risk Level</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {forecasts.map((f) => (
                      <tr key={f.sku} className="hover:bg-gray-50/60 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-gray-900">{f.productName}</div>
                          <div className="text-[11px] text-gray-400 font-mono">{f.sku}</div>
                        </td>
                        <td className="py-3 px-4 text-gray-600">{f.category}</td>
                        <td className="py-3 px-4 font-medium text-gray-800">{f.dailyVelocity} units/day</td>
                        <td className="py-3 px-4 font-bold text-gray-900">{f.stockOnHand}</td>
                        <td className="py-3 px-4 text-gray-800">{f.daysOfSupply} days</td>
                        <td className="py-3 px-4">
                          {f.riskLevel === 'CRITICAL_RISK' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                              Critical Risk
                            </span>
                          ) : f.riskLevel === 'STOCKOUT' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800 border border-rose-300">
                              Stockout
                            </span>
                          ) : f.riskLevel === 'LOW_STOCK' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                              Low Stock
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Normal
                            </span>
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
          {/* 7. WHATSAPP COMMERCE SIMULATOR (whatsapp-adapter backend) */}
          {/* ========================================================= */}
          {activeNav === 'whatsapp' && (
            <div className="space-y-5 max-w-3xl mx-auto">
              <div>
                <h1 className="text-xl font-bold text-gray-900 tracking-tight">WhatsApp Commerce Simulator</h1>
                <p className="text-gray-500 text-xs mt-0.5">
                  Test customer conversational orders, soap disambiguation, and cart checkout.
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[520px]">
                {/* Chat Header */}
                <div className="bg-[#075e54] text-white px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs">
                      FC
                    </div>
                    <div>
                      <div className="font-bold text-xs">FreshCart WhatsApp Bot</div>
                      <div className="text-[10px] text-emerald-200">Online</div>
                    </div>
                  </div>
                  <span className="text-[11px] text-white/80">+91 98765 43210</span>
                </div>

                {/* Messages Body */}
                <div className="flex-1 bg-[#efeae2] p-4 overflow-y-auto space-y-3">
                  {chatMessages.map((m, idx) => (
                    <div
                      key={idx}
                      className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-xl px-3.5 py-2 text-xs shadow-2xs whitespace-pre-wrap ${
                          m.sender === 'user'
                            ? 'bg-[#dcf8c6] text-gray-900 rounded-tr-none'
                            : 'bg-white text-gray-900 rounded-tl-none'
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
                              className="px-2.5 py-1 rounded-full bg-white hover:bg-emerald-50 text-emerald-800 text-[10px] font-semibold border border-emerald-200 shadow-2xs transition-colors"
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
                <div className="p-3 bg-white border-t border-gray-200 flex items-center gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
                    placeholder="Type message (e.g. soap, milk, atta, checkout)..."
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-emerald-600"
                  />
                  <button
                    onClick={() => handleSendChatMessage()}
                    className="p-2 rounded-lg bg-[#075e54] text-white hover:bg-[#064e46] transition-colors"
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

            <form onSubmit={handleCreateProductSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Select Primary Category</label>
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
                        className="text-emerald-600"
                      />
                      <span className="text-xs text-gray-700">Vegetarian</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        checked={!formIsVeg}
                        onChange={() => setFormIsVeg(false)}
                        className="text-emerald-600"
                      />
                      <span className="text-xs text-gray-700">Non-Veg</span>
                    </label>
                  </div>
                </div>
              </div>

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
      {/* MODAL 2: RECEIVE INBOUND SHIPMENT (GRN) */}
      {/* ========================================================= */}
      {isReceiveStockOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200">
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
                <label className="block text-xs font-semibold text-gray-700 mb-1">Select Product SKU</label>
                <select
                  value={receiveSku}
                  onChange={(e) => setReceiveSku(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white"
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
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Batch Number</label>
                  <input
                    type="text"
                    required
                    value={receiveBatchNumber}
                    onChange={(e) => setReceiveBatchNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    min={1}
                    value={receiveQuantity}
                    onChange={(e) => setReceiveQuantity(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Expiry Date</label>
                  <input
                    type="date"
                    required
                    value={receiveExpiryDate}
                    onChange={(e) => setReceiveExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Shelf Rack Location</label>
                  <input
                    type="text"
                    required
                    value={receiveLocationZone}
                    onChange={(e) => setReceiveLocationZone(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Supplier PO / Invoice Ref</label>
                <input
                  type="text"
                  value={receivePoRef}
                  onChange={(e) => setReceivePoRef(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs"
                />
              </div>

              <div className="pt-3 border-t border-gray-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsReceiveStockOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-xs text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#047857] hover:bg-[#065f46] text-white rounded-lg text-xs font-semibold"
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
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-200">
            <h3 className="font-bold text-base text-gray-900">Relocate Batch Rack</h3>
            <p className="text-gray-500 text-xs mt-1">
              Transfer <strong>{selectedBatchForMove.batchNumber}</strong> to a new shelf.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-gray-700 mb-1">New Shelf Rack Location</label>
              <input
                type="text"
                value={targetZoneForMove}
                onChange={(e) => setTargetZoneForMove(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono"
              />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setIsMoveZoneOpen(false)}
                className="px-3.5 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmMoveZone}
                className="px-3.5 py-1.5 bg-[#047857] hover:bg-[#065f46] text-white rounded-lg text-xs font-semibold"
              >
                Confirm Relocation
              </button>
            </div>
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
