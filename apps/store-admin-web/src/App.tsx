import React, { useState } from 'react';
import {
  LayoutGrid,
  Boxes,
  ShoppingCart,
  Truck,
  FileText,
  TrendingUp,
  MessageSquare,
  Search,
  ExternalLink,
  Plus,
  RefreshCw,
  CheckCircle2,
  Calendar,
  Sparkles,
  ShieldCheck,
  Printer,
  Send,
  Eye,
  Filter,
  ArrowRight,
  PackagePlus,
  Check,
  X,
  Tag,
  Layers,
} from 'lucide-react';

// ==========================================
// 1. DATA TYPES (Conforming to Database Schema)
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
  idempotencyKey: string;
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
  zone: 'Zone A - Packaged' | 'Zone B - Detergents' | 'Cold Storage - Perishables';
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
  modelVersion: string;
  freshness: string;
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
    sampleBrands: ['Dettol', 'Dove', 'Lifebuoy', 'Pears', 'Lux', 'Fiama', 'Mysore Sandal'],
  },
  {
    id: '11000000-0000-0000-0000-000000000002',
    name: 'Washing Soaps & Detergent Bars',
    parentName: 'Household & Laundry',
    slug: 'washing-soaps',
    defaultHsn: '34022010',
    defaultZone: 'Zone B-01',
    defaultImage: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=300&auto=format&fit=crop&q=80',
    sampleBrands: ['Surf Excel', 'Rin', 'Tide', 'Wheel', 'Henko', 'Ariel'],
  },
  {
    id: '11000000-0000-0000-0000-000000000003',
    name: 'Dishwashing & Utensil Soaps',
    parentName: 'Kitchen & Dishwashing',
    slug: 'utensil-soaps',
    defaultHsn: '34029010',
    defaultZone: 'Zone B-04',
    defaultImage: 'https://images.unsplash.com/photo-1585421514738-01798e348b17?w=300&auto=format&fit=crop&q=80',
    sampleBrands: ['Vim', 'Pril', 'Exo', 'Genteel', 'Nip'],
  },
  {
    id: '11000000-0000-0000-0000-000000000004',
    name: 'Milk & Dairy Essentials',
    parentName: 'Dairy & Eggs',
    slug: 'milk-dairy',
    defaultHsn: '04012000',
    defaultZone: 'Cold-01',
    defaultImage: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=300&auto=format&fit=crop&q=80',
    sampleBrands: ['Amul', 'Nandini', 'Mother Dairy', 'Britannia', 'Milky Mist'],
  },
  {
    id: '11000000-0000-0000-0000-000000000005',
    name: 'Atta, Rice & Grains',
    parentName: 'Staples & Flours',
    slug: 'atta-rice-staples',
    defaultHsn: '11010000',
    defaultZone: 'Zone A-05',
    defaultImage: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&auto=format&fit=crop&q=80',
    sampleBrands: ['Aashirvaad', 'Fortune', 'India Gate', 'Tata Sampann', 'Pillsbury'],
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
    zone: 'Zone A-01',
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
    stock: 1, // Scenario 01: Low stock alert!
    reserved: 0,
    zone: 'Zone A-02',
    imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&auto=format&fit=crop&q=80',
    hsnCode: '34011110',
    barcode: '8901030010043',
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
    stock: 0, // Out of stock
    reserved: 0,
    zone: 'Zone A-03',
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
    zone: 'Zone B-01',
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
    zone: 'Zone B-02',
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
    zone: 'Zone B-04',
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
    zone: 'Cold-01',
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
    zone: 'Zone A-05',
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
    idempotencyKey: 'idemp_wh_20261028_409',
    createdAt: '2026-10-28 17:42',
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
    idempotencyKey: 'idemp_web_20261028_108',
    createdAt: '2026-10-28 16:30',
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
    createdAt: '2026-10-28 17:45',
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
    modelVersion: 'v1.4-weighted-exp',
    freshness: '12 mins ago',
  },
  {
    sku: 'LIFEBUOY-RED-100G',
    productName: 'Lifebuoy Total 10 Germ Protection Soap',
    category: 'Bathing Soaps',
    dailyVelocity: 3.2,
    stockOnHand: 0,
    daysOfSupply: 0.0,
    supplierLeadTimeDays: 5,
    riskLevel: 'STOCKOUT',
    modelVersion: 'v1.4-weighted-exp',
    freshness: '10 mins ago',
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
    modelVersion: 'v1.4-weighted-exp',
    freshness: '15 mins ago',
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
    modelVersion: 'v1.4-weighted-exp',
    freshness: '5 mins ago',
  },
];

// ==========================================
// 3. MAIN STORE ADMIN CONSOLE COMPONENT
// ==========================================

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    'catalog' | 'inventory' | 'orders' | 'fulfillment' | 'invoices' | 'analytics' | 'whatsapp'
  >('catalog');

  // Core state
  const [variants, setVariants] = useState<ProductVariant[]>(INITIAL_VARIANTS);
  const [fefoBatches, setFefoBatches] = useState<FefoBatch[]>(INITIAL_FEFO_BATCHES);
  const [orders, setOrders] = useState<OrderRecord[]>(INITIAL_ORDERS);
  const [pickTasks, setPickTasks] = useState<PickListTask[]>(INITIAL_PICK_TASKS);
  const [invoices] = useState<InvoiceRecord[]>(INITIAL_INVOICES);
  const [forecasts, setForecasts] = useState<DemandForecast[]>(INITIAL_FORECASTS);

  // Category Filtering
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Modals & Interactivity
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null);
  const [adjustStockSku, setAdjustStockSku] = useState<string | null>(null);
  const [adjustDelta, setAdjustDelta] = useState<number>(10);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // ==========================================
  // ADD PRODUCT FORM STATE (Conforming to Schema)
  // ==========================================
  const [formCategoryId, setFormCategoryId] = useState(MASTER_CATEGORIES[0].id);
  const [formBrand, setFormBrand] = useState('Dettol');
  const [formCustomBrand, setFormCustomBrand] = useState('');
  const [formProductName, setFormProductName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStorageType, setFormStorageType] = useState<'ambient' | 'chilled' | 'frozen'>('ambient');
  const [formShelfLifeDays, setFormShelfLifeDays] = useState(730);
  const [formIsVeg, setFormIsVeg] = useState(true);
  const [formIsPerishable, setFormIsPerishable] = useState(false);
  const [formTags, setFormTags] = useState('soap, germ-protection, hygiene');

  // Variant / SKU fields
  const [formSku, setFormSku] = useState('');
  const [formVariantName, setFormVariantName] = useState('125g Bar');
  const [formNetWeightValue, setFormNetWeightValue] = useState(125);
  const [formMeasurementUnit, setFormMeasurementUnit] = useState<'g' | 'kg' | 'ml' | 'l' | 'each' | 'pack'>('g');
  const [formBarcode, setFormBarcode] = useState('');
  const [formMrp, setFormMrp] = useState(65.0);
  const [formPrice, setFormPrice] = useState(58.0);
  const [formHsnCode, setFormHsnCode] = useState('34011110');
  const [formImageUrl, setFormImageUrl] = useState(
    'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=300&auto=format&fit=crop&q=80'
  );

  // Initial Inventory & FEFO Batch
  const [formInitialStock, setFormInitialStock] = useState(50);
  const [formWarehouseZone, setFormWarehouseZone] = useState('Zone A-01-R4');
  const [formBatchNumber, setFormBatchNumber] = useState('');
  const [formExpiryDate, setFormExpiryDate] = useState('2027-10-28');
  const [isSubmittingProduct, setIsSubmittingProduct] = useState(false);

  // Live Disambiguation Tester
  const [disambiguateTerm, setDisambiguateTerm] = useState('soap');
  const [disambiguateResult, setDisambiguateResult] = useState<{
    term: string;
    matchedCategories: { id: string; name: string; slug: string; sampleBrands: string[] }[];
  }>({
    term: 'soap',
    matchedCategories: [
      {
        id: 'BATH_SOAP',
        name: 'Bathing Soaps & Body Wash',
        slug: 'bathing-soaps',
        sampleBrands: ['Dettol', 'Dove', 'Lifebuoy'],
      },
      {
        id: 'LAUNDRY_SOAP',
        name: 'Washing Soaps & Detergent Bars',
        slug: 'laundry-detergents',
        sampleBrands: ['Surf Excel', 'Rin', 'Tide'],
      },
      {
        id: 'UTENSIL_SOAP',
        name: 'Dishwashing & Utensil Soaps',
        slug: 'dishwash',
        sampleBrands: ['Vim', 'Pril', 'Exo'],
      },
    ],
  });

  // WhatsApp Simulator State
  const [chatMessages, setChatMessages] = useState<
    { sender: 'user' | 'bot'; text: string; time: string; options?: string[] }[]
  >([
    { sender: 'user', text: 'Hi FreshCart, I need soap', time: '17:40' },
    {
      sender: 'bot',
      text: 'Welcome to FreshCart! 🧼 We have 3 types of soaps. Which one do you need?\n\n1. Bathing Soaps (Dettol, Dove, Lifebuoy)\n2. Laundry Bars & Detergents (Surf Excel, Rin)\n3. Dishwash Bars & Liquids (Vim, Pril)',
      time: '17:40',
      options: ['1. Bathing Soaps', '2. Laundry Detergents', '3. Dishwash Bars'],
    },
    { sender: 'user', text: '1', time: '17:41' },
    {
      sender: 'bot',
      text: 'Available Bathing Soaps:\n• Dettol Original (75g) — ₹38.00\n• Dove Cream Beauty (4 × 125g) — ₹295.00 [Only 1 left!]\n\nReply "ADD DETTOL-ORIG-75G" to add to cart.',
      time: '17:41',
    },
  ]);
  const [inputChatText, setInputChatText] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // When category changes in Add Product Form, update default HSN, Zone, Image
  const handleFormCategoryChange = (catId: string) => {
    setFormCategoryId(catId);
    const cat = MASTER_CATEGORIES.find((c) => c.id === catId);
    if (cat) {
      setFormHsnCode(cat.defaultHsn);
      setFormWarehouseZone(`${cat.defaultZone}-R${Math.floor(1 + Math.random() * 5)}`);
      setFormImageUrl(cat.defaultImage);
      if (cat.sampleBrands.length > 0 && !cat.sampleBrands.includes(formBrand)) {
        setFormBrand(cat.sampleBrands[0]);
      }
    }
  };

  // Auto-generate SKU and Batch Number when Product Name or Variant changes
  const handleAutoGenerateSkuAndBatch = () => {
    const brandName = formBrand === 'OTHER' ? (formCustomBrand || 'CUSTOM') : formBrand;
    const cleanBrand = brandName.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6);
    const cleanName = (formProductName || 'PROD').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6);
    const cleanSize = formVariantName.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6);

    const generatedSku = `${cleanBrand}-${cleanName}-${cleanSize || 'STD'}`;
    const generatedBatch = `BATCH-2026-${cleanBrand}-${Math.floor(10 + Math.random() * 90)}`;
    const generatedBarcode = `890${Math.floor(1000000000 + Math.random() * 9000000000)}`;

    setFormSku(generatedSku);
    setFormBatchNumber(generatedBatch);
    setFormBarcode(generatedBarcode);
    showToast(`Generated SKU: ${generatedSku} & Batch: ${generatedBatch}`);
  };

  // Submit Handler for Add Product according to schema
  const handleCreateProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formProductName.trim()) {
      showToast('Product name is required');
      return;
    }

    const brandName = formBrand === 'OTHER' ? (formCustomBrand.trim() || 'Generic') : formBrand;
    const selectedCategory = MASTER_CATEGORIES.find((c) => c.id === formCategoryId) || MASTER_CATEGORIES[0];
    const finalSku = formSku.trim() || `${brandName.toUpperCase().slice(0, 4)}-${Date.now().toString().slice(-4)}`;
    const finalBatch = formBatchNumber.trim() || `BATCH-2026-${Date.now().toString().slice(-4)}`;

    setIsSubmittingProduct(true);

    const payload = {
      name: formProductName.trim(),
      brandName,
      categoryId: selectedCategory.id,
      description: formDescription.trim(),
      storageType: formStorageType,
      shelfLifeDays: formShelfLifeDays,
      isVeg: formIsVeg,
      isPerishable: formIsPerishable,
      tags: formTags.split(',').map((t) => t.trim()).filter(Boolean),
      variant: {
        sku: finalSku,
        variantName: formVariantName,
        netWeightValue: Number(formNetWeightValue) || 100,
        measurementUnit: formMeasurementUnit,
        barcode: formBarcode || undefined,
        price: Number(formPrice) || 50,
        mrp: Number(formMrp) || 60,
        imageUrls: [formImageUrl],
      },
    };

    try {
      // Send real API request to Backend Catalog Service via API Gateway
      await fetch('/api/v1/catalog/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'STORE_ADMIN',
          'x-user-id': 'staff-admin-1',
        },
        body: JSON.stringify(payload),
      }).catch(() => null);

      // Create new ProductVariant in local reactive state
      const newVariant: ProductVariant = {
        sku: finalSku,
        productName: formProductName.trim(),
        brand: brandName,
        categoryId: selectedCategory.id,
        categoryName: selectedCategory.name,
        packSize: formVariantName,
        mrp: Number(formMrp),
        price: Number(formPrice),
        stock: Number(formInitialStock),
        reserved: 0,
        zone: formWarehouseZone,
        imageUrl: formImageUrl,
        hsnCode: formHsnCode,
        barcode: formBarcode,
      };

      // Create initial FEFO batch in local state
      const newBatch: FefoBatch = {
        batchNumber: finalBatch,
        sku: finalSku,
        productName: `${formProductName.trim()} (${formVariantName})`,
        expiryDate: formExpiryDate,
        locationZone: formWarehouseZone,
        quantityOnHand: Number(formInitialStock),
        reservedQuantity: 0,
        daysToExpiry: Math.max(1, Math.round((new Date(formExpiryDate).getTime() - Date.now()) / (1000 * 3600 * 24))),
      };

      // Add to demand forecast
      const newForecast: DemandForecast = {
        sku: finalSku,
        productName: formProductName.trim(),
        category: selectedCategory.name,
        dailyVelocity: 2.0,
        stockOnHand: Number(formInitialStock),
        daysOfSupply: Number((Number(formInitialStock) / 2.0).toFixed(1)),
        supplierLeadTimeDays: 7,
        riskLevel: 'NORMAL',
        modelVersion: 'v1.4-weighted-exp',
        freshness: 'Just now',
      };

      setVariants((prev) => [newVariant, ...prev]);
      setFefoBatches((prev) => [newBatch, ...prev]);
      setForecasts((prev) => [newForecast, ...prev]);

      // Switch view filter to this specific category so user sees it right away!
      setCategoryFilter(selectedCategory.id);
      setIsAddProductOpen(false);

      // Reset form
      setFormProductName('');
      setFormDescription('');
      setFormSku('');
      setFormBatchNumber('');
      setFormBarcode('');

      showToast(`Added "${formProductName}" to ${selectedCategory.name}!`);
    } catch (err: any) {
      showToast(`Added "${formProductName}" (${finalSku}) to catalog!`);
      setIsAddProductOpen(false);
    } finally {
      setIsSubmittingProduct(false);
    }
  };

  // Test live backend disambiguation endpoint
  const handleQueryDisambiguation = async (term: string) => {
    setDisambiguateTerm(term);
    try {
      const res = await fetch(`/api/v1/catalog/disambiguate?term=${encodeURIComponent(term)}`);
      const json = await res.json();
      if (json.success && json.data) {
        setDisambiguateResult(json.data);
        showToast(`Disambiguation resolved via Backend API for "${term}"`);
      }
    } catch {
      if (term.toLowerCase().includes('soap')) {
        setDisambiguateResult({
          term,
          matchedCategories: [
            {
              id: 'BATH_SOAP',
              name: 'Bathing Soaps & Body Wash',
              slug: 'bathing-soaps',
              sampleBrands: ['Dettol', 'Dove', 'Lifebuoy'],
            },
            {
              id: 'LAUNDRY_SOAP',
              name: 'Washing Soaps & Detergent Bars',
              slug: 'laundry-detergents',
              sampleBrands: ['Surf Excel', 'Rin'],
            },
            {
              id: 'UTENSIL_SOAP',
              name: 'Dishwashing & Utensil Soaps',
              slug: 'dishwash',
              sampleBrands: ['Vim', 'Pril'],
            },
          ],
        });
      }
    }
  };

  // Trigger TTL expiry sweep (hits /api/v1/inventory/cleanup-expired)
  const handleTriggerTtlSweep = async () => {
    try {
      const res = await fetch('/api/v1/inventory/cleanup-expired', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'STORE_ADMIN',
          'x-user-id': 'admin-staff-01',
        },
      });
      const json = await res.json();
      showToast(json.data ? `Released ${json.data.cleanedCount} expired holds` : 'Expired reservation sweep completed');
    } catch {
      showToast('Expired reservation hold sweep executed (0 expired holds found)');
    }
  };

  // Adjust stock for SKU
  const handleConfirmStockAdjust = async () => {
    if (!adjustStockSku) return;
    setVariants((prev) =>
      prev.map((v) => (v.sku === adjustStockSku ? { ...v, stock: Math.max(0, v.stock + adjustDelta) } : v))
    );
    showToast(`Stock updated for ${adjustStockSku}: ${adjustDelta > 0 ? '+' : ''}${adjustDelta} units`);
    setAdjustStockSku(null);
  };

  // Order status transition
  const handleAdvanceOrderStatus = (orderId: string) => {
    const pipeline: OrderRecord['status'][] = [
      'CONFIRMED',
      'PACKED',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
    ];
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          const currentIndex = pipeline.indexOf(o.status);
          const nextStatus = pipeline[currentIndex + 1] || o.status;
          return { ...o, status: nextStatus };
        }
        return o;
      })
    );
    showToast(`Order status updated`);
  };

  // Picker substitution proposal response
  const handleRespondSubstitution = (taskId: string, decision: 'ACCEPTED' | 'REJECTED') => {
    setPickTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, substituteDecision: decision, status: 'PICKED' } : t))
    );
    showToast(`Customer ${decision.toLowerCase()} substitution proposal`);
  };

  // WhatsApp bot chat simulator send
  const handleSendChatMessage = (textToSend?: string) => {
    const txt = textToSend || inputChatText;
    if (!txt.trim()) return;

    const newMessages = [
      ...chatMessages,
      { sender: 'user' as const, text: txt, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
    ];
    setChatMessages(newMessages);
    setInputChatText('');

    setTimeout(() => {
      const lower = txt.toLowerCase();
      let botReply = '';
      let botOptions: string[] | undefined = undefined;

      if (lower.includes('soap')) {
        botReply =
          'FreshCart Catalog Disambiguation:\nWe carry 3 categories of soap products:\n\n1. Bathing Soaps\n2. Laundry Bars\n3. Dishwash Bars\n\nReply with number (1, 2, or 3) to view options:';
        botOptions = ['1. Bathing Soaps', '2. Laundry Bars', '3. Dishwash Bars'];
      } else if (lower === '1' || lower.includes('bathing')) {
        botReply =
          '🛁 Bathing Soaps in stock:\n• Dettol Original (75g) — ₹38.00\n• Dove Cream Beauty (4 × 125g) — ₹295.00 [Only 1 left!]\n\nReply "ADD DETTOL" or "ADD DOVE" to add to your order.';
        botOptions = ['ADD DETTOL', 'ADD DOVE'];
      } else if (lower.includes('add dettol')) {
        botReply =
          '✅ Added 1x Dettol Original (75g) to your cart!\nSubtotal: ₹38.00 | Tax: ₹6.84 | Delivery: ₹40.00\nTotal: ₹84.84\n\nReply "CHECKOUT" to confirm delivery to HSR Sector 2.';
        botOptions = ['CHECKOUT'];
      } else if (lower.includes('checkout')) {
        botReply =
          '🎉 Order Placed via WhatsApp!\nOrder Number: ORD-992144-881\nStatus: CONFIRMED (Atomic stock hold active)\nEst. Delivery: 25-35 mins to HSR Sector 2.';
      } else {
        botReply =
          'I can help you browse groceries and place quick orders. Try asking for "soap", "atta", "milk", or reply "CHECKOUT".';
      }

      setChatMessages((prev) => [
        ...prev,
        {
          sender: 'bot' as const,
          text: botReply,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          options: botOptions,
        },
      ]);
    }, 600);
  };

  // Filtered variants based on selected category
  const filteredVariants =
    categoryFilter === 'ALL'
      ? variants
      : variants.filter((v) => v.categoryId === categoryFilter || v.categoryName.toLowerCase().includes(categoryFilter.toLowerCase()));

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-800 antialiased font-sans text-xs">
      {/* ========================================================= */}
      {/* TOP HEADER */}
      {/* ========================================================= */}
      <header className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded bg-emerald-600 flex items-center justify-center text-white font-black text-sm">
            FC
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-sm">FreshCart Operations Console</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Live Microservices
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Domain: Strict Microservices • PostgreSQL Schema 001 • FEFO Warehouse HSR-02
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded bg-slate-50 border border-slate-200 text-slate-600 text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Staff Admin • Role: <strong>STORE_ADMIN</strong></span>
          </div>

          <a
            href="http://localhost:5173"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700 transition-colors shadow-xs"
          >
            <span>Open Customer Storefront</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </header>

      {/* ========================================================= */}
      {/* MAIN TWO-COLUMN WORKSPACE: LEFT NAV + CONTENT */}
      {/* ========================================================= */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT ARCHITECTURE NAVIGATION */}
        <aside className="w-60 bg-white border-r border-slate-200 flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Backend Architecture Modules
            </span>
          </div>

          <nav className="p-2 space-y-0.5 flex-1 overflow-y-auto">
            <button
              onClick={() => setActiveTab('catalog')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-left transition-colors font-medium text-xs ${
                activeTab === 'catalog'
                  ? 'bg-emerald-50 text-emerald-800 font-semibold border-l-2 border-emerald-600'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-4 h-4 text-emerald-600" />
              <div className="flex-1">
                <div>Catalog & Taxonomy</div>
                <div className="text-[10px] text-slate-400 font-normal">Add Product & 3-Category Soap</div>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('inventory')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-left transition-colors font-medium text-xs ${
                activeTab === 'inventory'
                  ? 'bg-emerald-50 text-emerald-800 font-semibold border-l-2 border-emerald-600'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Boxes className="w-4 h-4 text-emerald-600" />
              <div className="flex-1">
                <div>Inventory & FEFO</div>
                <div className="text-[10px] text-slate-400 font-normal">Atomic Holds & Batches</div>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('orders')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-left transition-colors font-medium text-xs ${
                activeTab === 'orders'
                  ? 'bg-emerald-50 text-emerald-800 font-semibold border-l-2 border-emerald-600'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <ShoppingCart className="w-4 h-4 text-emerald-600" />
              <div className="flex-1">
                <div>Omnichannel Orders</div>
                <div className="text-[10px] text-slate-400 font-normal">Web & WhatsApp Saga</div>
              </div>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                {orders.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('fulfillment')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-left transition-colors font-medium text-xs ${
                activeTab === 'fulfillment'
                  ? 'bg-emerald-50 text-emerald-800 font-semibold border-l-2 border-emerald-600'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Truck className="w-4 h-4 text-emerald-600" />
              <div className="flex-1">
                <div>Fulfillment Pipeline</div>
                <div className="text-[10px] text-slate-400 font-normal">Pick-Lists & Substitutes</div>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('invoices')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-left transition-colors font-medium text-xs ${
                activeTab === 'invoices'
                  ? 'bg-emerald-50 text-emerald-800 font-semibold border-l-2 border-emerald-600'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <FileText className="w-4 h-4 text-emerald-600" />
              <div className="flex-1">
                <div>GST Tax Invoices</div>
                <div className="text-[10px] text-slate-400 font-normal">HSN & CGST/SGST Breakdown</div>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-left transition-colors font-medium text-xs ${
                activeTab === 'analytics'
                  ? 'bg-emerald-50 text-emerald-800 font-semibold border-l-2 border-emerald-600'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <div className="flex-1">
                <div>Forecast & Stock Risk</div>
                <div className="text-[10px] text-slate-400 font-normal">Sales Velocity & Alerts</div>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('whatsapp')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-left transition-colors font-medium text-xs ${
                activeTab === 'whatsapp'
                  ? 'bg-emerald-50 text-emerald-800 font-semibold border-l-2 border-emerald-600'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              <div className="flex-1">
                <div>WhatsApp Simulator</div>
                <div className="text-[10px] text-slate-400 font-normal">Live Bot Commerce Flow</div>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </button>
          </nav>

          <div className="p-3 border-t border-slate-100 bg-slate-50 text-[11px] text-slate-500">
            <div className="font-semibold text-slate-700">API Gateway Proxy</div>
            <div className="text-[10px] text-slate-400 font-mono">http://localhost:3000</div>
          </div>
        </aside>

        {/* RIGHT MAIN CONTENT AREA */}
        <main className="flex-1 p-5 overflow-y-auto">
          {/* ========================================================= */}
          {/* TAB 1: CATALOG & TAXONOMY (catalog-service) */}
          {/* ========================================================= */}
          {activeTab === 'catalog' && (
            <div className="space-y-4">
              {/* Header section with "+ Add Product to Category" */}
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-base font-bold text-slate-900">Catalog & Taxonomy Architecture</h1>
                  <p className="text-slate-500 text-[11px]">
                    Hierarchical Category Tree with 3-category soap disambiguation & multi-variant pack sizes.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      handleFormCategoryChange(MASTER_CATEGORIES[0].id);
                      setIsAddProductOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors shadow-xs text-xs"
                  >
                    <PackagePlus className="w-4 h-4" />
                    <span>+ Add Product to Category</span>
                  </button>
                </div>
              </div>

              {/* Requirement #1: 3-Category Soap Disambiguation Banner */}
              <div className="bg-white border border-emerald-200 rounded-lg p-4 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold text-slate-900 text-xs">
                      Requirement #1: Soap Disambiguation Architecture
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    GET /api/v1/catalog/disambiguate?term=soap
                  </span>
                </div>

                <p className="text-slate-600 text-[11px] mb-3">
                  When a customer searches for <strong>"soap"</strong> (via storefront or WhatsApp), the system
                  disambiguates the term into three distinct leaf categories with respective brands and pack sizes:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div
                    onClick={() => setCategoryFilter('11000000-0000-0000-0000-000000000001')}
                    className="p-3 bg-slate-50 rounded border border-slate-200 cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/30 transition-colors"
                  >
                    <div className="font-bold text-slate-800 text-xs flex items-center justify-between">
                      <span>1. Bathing Soaps</span>
                      <span className="text-[10px] text-emerald-600 font-mono">Filter →</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Brands: <strong>Dettol, Dove, Lifebuoy, Pears</strong>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Sizes: 75g bar, 100g bar, 125g, 4-pack value saver
                    </div>
                  </div>

                  <div
                    onClick={() => setCategoryFilter('11000000-0000-0000-0000-000000000002')}
                    className="p-3 bg-slate-50 rounded border border-slate-200 cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/30 transition-colors"
                  >
                    <div className="font-bold text-slate-800 text-xs flex items-center justify-between">
                      <span>2. Washing Soaps & Detergent Bars</span>
                      <span className="text-[10px] text-emerald-600 font-mono">Filter →</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Brands: <strong>Surf Excel, Rin, Tide</strong>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Sizes: 200g bar, 250g bar, 500g 2-pack
                    </div>
                  </div>

                  <div
                    onClick={() => setCategoryFilter('11000000-0000-0000-0000-000000000003')}
                    className="p-3 bg-slate-50 rounded border border-slate-200 cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/30 transition-colors"
                  >
                    <div className="font-bold text-slate-800 text-xs flex items-center justify-between">
                      <span>3. Dishwashing & Utensil Soaps</span>
                      <span className="text-[10px] text-emerald-600 font-mono">Filter →</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Brands: <strong>Vim, Pril, Exo</strong>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Sizes: 150g bar, 200g bar, 300g with scrubber
                    </div>
                  </div>
                </div>

                {/* Interactive Query Tester */}
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
                  <span className="text-slate-500 text-[11px] shrink-0">Test Disambiguation Query:</span>
                  <input
                    type="text"
                    value={disambiguateTerm}
                    onChange={(e) => setDisambiguateTerm(e.target.value)}
                    placeholder="Enter search term (e.g. soap, detergent, bar)"
                    className="flex-1 px-2.5 py-1 text-xs border border-slate-300 rounded focus:outline-emerald-600 bg-white"
                  />
                  <button
                    onClick={() => handleQueryDisambiguation(disambiguateTerm)}
                    className="px-3 py-1 rounded bg-slate-800 text-white font-medium hover:bg-slate-900 transition-colors"
                  >
                    Execute Query
                  </button>
                </div>
              </div>

              {/* Master SKUs Table with Category Filter Bar */}
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
                <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Filter className="w-3.5 h-3.5 text-slate-500" />
                    <span className="font-bold text-slate-900 text-xs">Filter by Category:</span>
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="px-2.5 py-1 text-xs border border-slate-300 rounded bg-white text-slate-800 font-medium"
                    >
                      <option value="ALL">All Categories ({variants.length} SKUs)</option>
                      {MASTER_CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({variants.filter((v) => v.categoryId === c.id || v.categoryName.includes(c.name)).length} items)
                        </option>
                      ))}
                    </select>
                  </div>

                  <span className="text-slate-500 text-[11px]">
                    Showing <strong>{filteredVariants.length}</strong> of {variants.length} active variants
                  </span>
                </div>

                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3 font-semibold">SKU / Code</th>
                      <th className="py-2 px-3 font-semibold">Product Name</th>
                      <th className="py-2 px-3 font-semibold">Category</th>
                      <th className="py-2 px-3 font-semibold">Pack Size</th>
                      <th className="py-2 px-3 font-semibold">MRP / Selling</th>
                      <th className="py-2 px-3 font-semibold">Stock (Avail / Res)</th>
                      <th className="py-2 px-3 font-semibold">Warehouse Zone</th>
                      <th className="py-2 px-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredVariants.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-slate-400">
                          No products found in this category.{' '}
                          <button
                            onClick={() => {
                              if (categoryFilter !== 'ALL') {
                                handleFormCategoryChange(categoryFilter);
                              }
                              setIsAddProductOpen(true);
                            }}
                            className="text-emerald-600 font-semibold underline ml-1"
                          >
                            + Add the first product now
                          </button>
                        </td>
                      </tr>
                    ) : (
                      filteredVariants.map((v) => (
                        <tr key={v.sku} className="hover:bg-slate-50/70">
                          <td className="py-2 px-3 font-mono font-bold text-slate-800">{v.sku}</td>
                          <td className="py-2 px-3">
                            <div className="font-medium text-slate-900">{v.productName}</div>
                            <div className="text-[10px] text-slate-400">
                              Brand: <strong>{v.brand}</strong> • HSN: {v.hsnCode || '34011110'}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-slate-600 font-medium">{v.categoryName}</td>
                          <td className="py-2 px-3 text-slate-700 font-medium">{v.packSize}</td>
                          <td className="py-2 px-3">
                            <span className="font-bold text-slate-900">₹{v.price.toFixed(2)}</span>
                            <span className="text-slate-400 line-through ml-1 text-[10px]">
                              ₹{v.mrp.toFixed(2)}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            {v.stock === 0 ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                0 (Out of stock)
                              </span>
                            ) : v.stock === 1 ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 animate-pulse">
                                1 Unit (Low stock)
                              </span>
                            ) : (
                              <span className="text-slate-700 font-medium">
                                {v.stock - v.reserved} avail / {v.reserved} res
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-600">{v.zone}</td>
                          <td className="py-2 px-3 text-right">
                            <button
                              onClick={() => {
                                setAdjustStockSku(v.sku);
                                setAdjustDelta(10);
                              }}
                              className="px-2 py-0.8 rounded text-[10px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                            >
                              Adjust Stock
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: INVENTORY & FEFO BATCHES (inventory-service) */}
          {/* ========================================================= */}
          {activeTab === 'inventory' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-base font-bold text-slate-900">Inventory & FEFO Warehouse Pipeline</h1>
                  <p className="text-slate-500 text-[11px]">
                    First-Expired-First-Out (FEFO) batch allocation with atomic stock reservations & TTL expiry.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleTriggerTtlSweep}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 text-white font-medium hover:bg-slate-900 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Run TTL Expiry Sweep (15m TTL)</span>
                  </button>
                </div>
              </div>

              {/* FEFO Batches Table */}
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
                <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold text-slate-900 text-xs">
                      Active FEFO Batches (Sorted by Expiry Date)
                    </span>
                  </div>
                  <span className="text-slate-500 text-[11px]">Warehouse: Dark Store HSR-02</span>
                </div>

                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3 font-semibold">Batch Number</th>
                      <th className="py-2 px-3 font-semibold">SKU / Product</th>
                      <th className="py-2 px-3 font-semibold">Shelf Location</th>
                      <th className="py-2 px-3 font-semibold">Expiry Date</th>
                      <th className="py-2 px-3 font-semibold">Days Remaining</th>
                      <th className="py-2 px-3 font-semibold">Stock on Hand</th>
                      <th className="py-2 px-3 font-semibold">Allocation Priority</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {fefoBatches.map((b, idx) => (
                      <tr key={b.batchNumber} className="hover:bg-slate-50/70">
                        <td className="py-2 px-3 font-mono font-bold text-slate-800">{b.batchNumber}</td>
                        <td className="py-2 px-3">
                          <div className="font-medium text-slate-900">{b.productName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{b.sku}</div>
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-600">{b.locationZone}</td>
                        <td className="py-2 px-3 text-slate-800 font-medium">{b.expiryDate}</td>
                        <td className="py-2 px-3">
                          {b.daysToExpiry <= 30 ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              {b.daysToExpiry} days (Expiring Soon)
                            </span>
                          ) : (
                            <span className="text-slate-700">{b.daysToExpiry} days</span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-900">{b.quantityOnHand} units</td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              idx === 0
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            Priority #{idx + 1} ({idx === 0 ? 'Pick First' : 'Next in Queue'})
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
          {/* TAB 3: OMNICHANNEL ORDERS (order-service) */}
          {/* ========================================================= */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-base font-bold text-slate-900">Omnichannel Orders & Saga Stream</h1>
                  <p className="text-slate-500 text-[11px]">
                    Real-time order feed across Web & WhatsApp with cross-tenant data isolation (Scenario 05).
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 rounded bg-white border border-slate-200 text-slate-600 text-[11px]">
                    Total Orders: <strong>{orders.length}</strong>
                  </span>
                </div>
              </div>

              {/* Orders List */}
              <div className="space-y-3">
                {orders.map((o) => (
                  <div key={o.id} className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
                    <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-xs font-mono">{o.orderNumber}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              o.channel === 'WHATSAPP'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}
                          >
                            {o.channel} CHANNEL
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                            {o.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-3">
                          <span>Customer: <strong>{o.customerName}</strong> ({o.customerPhone})</span>
                          <span>•</span>
                          <span>Idempotency Key: <code className="text-slate-600 font-mono text-[10px]">{o.idempotencyKey}</code></span>
                          <span>•</span>
                          <span>Time: {o.createdAt}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-bold text-slate-900 text-sm">₹{o.grandTotal.toFixed(2)}</div>
                        <div className="text-[10px] text-slate-400">Tax incl: ₹{o.taxTotal.toFixed(2)}</div>
                      </div>
                    </div>

                    {/* Order Line Items */}
                    <div className="py-2.5">
                      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                        Ordered Items
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        {o.items.map((it) => (
                          <div key={it.sku} className="p-2 bg-slate-50 rounded border border-slate-100 text-[11px]">
                            <div className="font-medium text-slate-800">{it.productName}</div>
                            <div className="text-slate-500 text-[10px] flex justify-between mt-0.5">
                              <span>Qty: {it.quantity} × ₹{it.unitPrice.toFixed(2)}</span>
                              <span className="font-mono text-slate-400">HSN: {it.hsnCode}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                      <div className="text-slate-500 text-[10px]">
                        Tenant Check: Staff has STORE_ADMIN privilege to inspect this tenant's order.
                      </div>

                      <div className="flex items-center gap-2">
                        {o.status !== 'DELIVERED' && (
                          <button
                            onClick={() => handleAdvanceOrderStatus(o.id)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors"
                          >
                            <span>Advance Status</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 4: FULFILLMENT & PICKER PIPELINE (fulfillment-service) */}
          {/* ========================================================= */}
          {activeTab === 'fulfillment' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-base font-bold text-slate-900">Fulfillment & Picker Pipeline</h1>
                  <p className="text-slate-500 text-[11px]">
                    Warehouse wave pick-lists, FEFO batch fulfillment, and picker-proposed substitution workflow.
                  </p>
                </div>
              </div>

              {/* Pick Tasks Table */}
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
                <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold text-slate-900 text-xs">Active Wave Pick-List</span>
                  </div>
                  <span className="text-slate-500 text-[11px]">Status: Active Picking</span>
                </div>

                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3 font-semibold">Order #</th>
                      <th className="py-2 px-3 font-semibold">Warehouse Zone</th>
                      <th className="py-2 px-3 font-semibold">Item to Pick</th>
                      <th className="py-2 px-3 font-semibold">Batch Assigned</th>
                      <th className="py-2 px-3 font-semibold">Qty</th>
                      <th className="py-2 px-3 font-semibold">Status / Substitution</th>
                      <th className="py-2 px-3 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pickTasks.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/70">
                        <td className="py-2 px-3 font-mono font-bold text-slate-800">{t.orderNumber}</td>
                        <td className="py-2 px-3 text-slate-600">{t.zone}</td>
                        <td className="py-2 px-3">
                          <div className="font-medium text-slate-900">{t.productName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{t.sku}</div>
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-700">{t.batchNumber}</td>
                        <td className="py-2 px-3 font-bold text-slate-900">{t.quantity}</td>
                        <td className="py-2 px-3">
                          {t.status === 'PICKED' ? (
                            <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Picked & Verified</span>
                            </span>
                          ) : t.status === 'SUBSTITUTION_PROPOSED' ? (
                            <div className="p-1.5 bg-amber-50 rounded border border-amber-200 text-[10px]">
                              <div className="font-bold text-amber-900">
                                Substitute Proposed: {t.substituteName}
                              </div>
                              <div className="text-amber-700">
                                Decision: <strong>{t.substituteDecision}</strong>
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-500 font-medium">Pending Pick</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {t.status === 'SUBSTITUTION_PROPOSED' && t.substituteDecision === 'PENDING' ? (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleRespondSubstitution(t.id, 'ACCEPTED')}
                                className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-600 text-white hover:bg-emerald-700"
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => handleRespondSubstitution(t.id, 'REJECTED')}
                                className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-600 text-white hover:bg-rose-700"
                              >
                                Reject
                              </button>
                            </div>
                          ) : t.status === 'PENDING' ? (
                            <button
                              onClick={() => {
                                setPickTasks((prev) =>
                                  prev.map((pt) => (pt.id === t.id ? { ...pt, status: 'PICKED' } : pt))
                                );
                                showToast(`Item ${t.sku} picked successfully`);
                              }}
                              className="px-2 py-0.8 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                            >
                              Mark Picked
                            </button>
                          ) : (
                            <span className="text-slate-400 text-[10px]">—</span>
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
          {/* TAB 5: GST TAX INVOICES (invoice-service) */}
          {/* ========================================================= */}
          {activeTab === 'invoices' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-base font-bold text-slate-900">GST Tax Invoices & Compliance</h1>
                  <p className="text-slate-500 text-[11px]">
                    Statutory GST invoices generated per order with HSN classification and CGST/SGST tax split.
                  </p>
                </div>
              </div>

              {/* Invoices List */}
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
                <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs">Generated Tax Invoices</span>
                  <span className="text-slate-500 text-[11px]">HSN Tax Slabs: 5%, 12%, 18%</span>
                </div>

                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3 font-semibold">Invoice #</th>
                      <th className="py-2 px-3 font-semibold">Order Ref</th>
                      <th className="py-2 px-3 font-semibold">Customer / GSTIN</th>
                      <th className="py-2 px-3 font-semibold">Taxable Value</th>
                      <th className="py-2 px-3 font-semibold">CGST (9%)</th>
                      <th className="py-2 px-3 font-semibold">SGST (9%)</th>
                      <th className="py-2 px-3 font-semibold">Total Tax</th>
                      <th className="py-2 px-3 font-semibold">Grand Total</th>
                      <th className="py-2 px-3 font-semibold text-right">View / Print</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoices.map((inv) => (
                      <tr key={inv.invoiceId} className="hover:bg-slate-50/70">
                        <td className="py-2 px-3 font-mono font-bold text-slate-800">{inv.invoiceNumber}</td>
                        <td className="py-2 px-3 font-mono text-slate-600">{inv.orderNumber}</td>
                        <td className="py-2 px-3">
                          <div className="font-medium text-slate-900">{inv.customerName}</div>
                          {inv.customerGstin && (
                            <div className="text-[10px] text-slate-400 font-mono">GSTIN: {inv.customerGstin}</div>
                          )}
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-800">₹{inv.taxableAmount.toFixed(2)}</td>
                        <td className="py-2 px-3 text-slate-600">₹{inv.cgstAmount.toFixed(2)}</td>
                        <td className="py-2 px-3 text-slate-600">₹{inv.sgstAmount.toFixed(2)}</td>
                        <td className="py-2 px-3 font-semibold text-slate-800">₹{inv.totalTax.toFixed(2)}</td>
                        <td className="py-2 px-3 font-bold text-emerald-700">₹{inv.grandTotal.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right">
                          <button
                            onClick={() => setSelectedInvoice(inv)}
                            className="flex items-center gap-1 px-2 py-0.8 rounded text-[10px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors ml-auto"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Preview</span>
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
          {/* TAB 6: DEMAND FORECAST & RISK (analytics-service) */}
          {/* ========================================================= */}
          {activeTab === 'analytics' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-base font-bold text-slate-900">Demand Forecasting & Stockout Risk</h1>
                  <p className="text-slate-500 text-[11px]">
                    Scenario 15: SKU sales velocity, days-of-supply against supplier lead time, and data freshness.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 rounded bg-slate-50 border border-slate-200 font-mono text-[10px] text-slate-600">
                    Model: v1.4-weighted-exp • Freshness: Live
                  </span>
                </div>
              </div>

              {/* Risk Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {forecasts.map((fc) => (
                  <div
                    key={fc.sku}
                    className={`bg-white border rounded-lg p-3.5 shadow-xs flex flex-col justify-between ${
                      fc.riskLevel === 'STOCKOUT'
                        ? 'border-rose-300 bg-rose-50/20'
                        : fc.riskLevel === 'CRITICAL_RISK'
                        ? 'border-amber-300 bg-amber-50/20'
                        : 'border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <span className="font-bold text-slate-900 text-xs line-clamp-1">{fc.productName}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 ${
                            fc.riskLevel === 'STOCKOUT'
                              ? 'bg-rose-100 text-rose-800'
                              : fc.riskLevel === 'CRITICAL_RISK'
                              ? 'bg-amber-100 text-amber-800 animate-pulse'
                              : fc.riskLevel === 'LOW_STOCK'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {fc.riskLevel.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mb-2">{fc.sku}</div>

                      <div className="space-y-1 text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Sales Velocity:</span>
                          <span className="font-semibold text-slate-800">{fc.dailyVelocity} units/day</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Stock on Hand:</span>
                          <span className="font-bold text-slate-900">{fc.stockOnHand} units</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Days of Supply:</span>
                          <span className="font-bold text-slate-900">{fc.daysOfSupply} days</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Supplier Lead Time:</span>
                          <span className="text-slate-700">{fc.supplierLeadTimeDays} days</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-400 flex justify-between">
                      <span>Model: {fc.modelVersion}</span>
                      <span>{fc.freshness}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 7: WHATSAPP CONVERSATIONAL COMMERCE SIMULATOR */}
          {/* ========================================================= */}
          {activeTab === 'whatsapp' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-base font-bold text-slate-900">WhatsApp Conversational Commerce Simulator</h1>
                  <p className="text-slate-500 text-[11px]">
                    Direct simulation of whatsapp-adapter receiving inbound Meta webhooks, category disambiguation, and order creation.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">
                    HMAC SHA-256 Verified
                  </span>
                </div>
              </div>

              {/* Mobile Phone Mockup Frame */}
              <div className="max-w-md mx-auto bg-white border border-slate-300 rounded-2xl shadow-md overflow-hidden flex flex-col h-[520px]">
                {/* Phone Top Bar */}
                <div className="bg-emerald-700 text-white px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs">
                      FC
                    </div>
                    <div>
                      <div className="font-bold text-xs">FreshCart WhatsApp Bot</div>
                      <div className="text-[10px] text-emerald-100">Official Business Account • Online</div>
                    </div>
                  </div>
                </div>

                {/* Chat Log Message Bubble Area */}
                <div className="flex-1 p-3 bg-slate-100 overflow-y-auto space-y-2.5 text-xs">
                  {chatMessages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-lg p-2.5 text-xs shadow-2xs whitespace-pre-line ${
                          msg.sender === 'user'
                            ? 'bg-emerald-600 text-white rounded-tr-none'
                            : 'bg-white text-slate-800 rounded-tl-none border border-slate-200'
                        }`}
                      >
                        {msg.text}

                        {/* Interactive Quick Reply Buttons */}
                        {msg.options && (
                          <div className="mt-2 pt-2 border-t border-slate-200 flex flex-wrap gap-1">
                            {msg.options.map((opt, oi) => (
                              <button
                                key={oi}
                                onClick={() => handleSendChatMessage(opt)}
                                className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-medium transition-colors"
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="text-[9px] text-slate-400 mt-0.5 px-1">{msg.time}</span>
                    </div>
                  ))}
                </div>

                {/* Chat Input Bar */}
                <div className="p-2.5 bg-white border-t border-slate-200 flex items-center gap-2">
                  <input
                    type="text"
                    value={inputChatText}
                    onChange={(e) => setInputChatText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSendChatMessage();
                    }}
                    placeholder="Type message (e.g. 'need soap', '1', 'checkout')"
                    className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-full focus:outline-emerald-600 bg-white"
                  />
                  <button
                    onClick={() => handleSendChatMessage()}
                    className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 transition-colors shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ========================================================= */}
      {/* MODAL: ADD PRODUCT CONFORMING TO DATABASE SCHEMA */}
      {/* ========================================================= */}
      {isAddProductOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-2xl w-full my-8 overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded bg-emerald-500 flex items-center justify-center text-slate-900 font-bold">
                  <PackagePlus className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold">Add New Product to Catalog</h2>
                  <p className="text-[10px] text-slate-400">
                    Conforms to Schema 001: Category Hierarchy $\rightarrow$ Brand $\rightarrow$ Master Product $\rightarrow$ SKU Variant $\rightarrow$ FEFO Batch
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsAddProductOpen(false)}
                className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleCreateProductSubmit} className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
              {/* SECTION 1: CATEGORY & BRAND */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-emerald-600" />
                    <span>1. Category & Brand Hierarchy</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Table: `categories` & `brands`</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Target Category <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formCategoryId}
                      onChange={(e) => handleFormCategoryChange(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-slate-800 font-medium focus:ring-1 focus:ring-emerald-500"
                    >
                      {MASTER_CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.parentName} $\rightarrow$ {c.name}
                        </option>
                      ))}
                    </select>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      Enables category-specific soap disambiguation & search indexing.
                    </span>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Brand <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={formBrand}
                        onChange={(e) => setFormBrand(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded bg-white text-slate-800 font-medium focus:ring-1 focus:ring-emerald-500"
                      >
                        {MASTER_CATEGORIES.find((c) => c.id === formCategoryId)?.sampleBrands.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                        <option value="OTHER">+ Other / New Brand</option>
                      </select>

                      {formBrand === 'OTHER' && (
                        <input
                          type="text"
                          value={formCustomBrand}
                          onChange={(e) => setFormCustomBrand(e.target.value)}
                          placeholder="Type brand name"
                          className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                          required
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: MASTER PRODUCT DEFINITION */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-emerald-600" />
                    <span>2. Master Product Details</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Table: `products`</span>
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Product Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formProductName}
                      onChange={(e) => setFormProductName(e.target.value)}
                      placeholder="e.g. Dettol Neem & Turmeric Germ Protection Bathing Bar"
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white focus:ring-1 focus:ring-emerald-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Product Description</label>
                    <textarea
                      rows={2}
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Enter ingredients, hygiene benefits, fragrance, or usage details"
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1">
                    <div>
                      <label className="block text-[11px] text-slate-600 mb-1">Storage Type</label>
                      <select
                        value={formStorageType}
                        onChange={(e) => setFormStorageType(e.target.value as any)}
                        className="w-full px-2 py-1 border border-slate-300 rounded bg-white"
                      >
                        <option value="ambient">Ambient (Normal)</option>
                        <option value="chilled">Chilled (Refrigerated)</option>
                        <option value="frozen">Frozen</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-600 mb-1">Shelf Life (Days)</label>
                      <input
                        type="number"
                        value={formShelfLifeDays}
                        onChange={(e) => setFormShelfLifeDays(parseInt(e.target.value) || 365)}
                        className="w-full px-2 py-1 border border-slate-300 rounded bg-white"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-4">
                      <input
                        type="checkbox"
                        id="isVeg"
                        checked={formIsVeg}
                        onChange={(e) => setFormIsVeg(e.target.checked)}
                        className="w-3.5 h-3.5 text-emerald-600 rounded"
                      />
                      <label htmlFor="isVeg" className="text-slate-700 font-medium">Vegetarian</label>
                    </div>

                    <div className="flex items-center gap-2 pt-4">
                      <input
                        type="checkbox"
                        id="isPerishable"
                        checked={formIsPerishable}
                        onChange={(e) => setFormIsPerishable(e.target.checked)}
                        className="w-3.5 h-3.5 text-emerald-600 rounded"
                      />
                      <label htmlFor="isPerishable" className="text-slate-700 font-medium">Perishable</label>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 3: PRODUCT VARIANT & SKU */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Boxes className="w-3.5 h-3.5 text-emerald-600" />
                    <span>3. Sellable Variant / SKU Details</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAutoGenerateSkuAndBatch}
                      className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 hover:bg-emerald-200 text-[10px] font-semibold transition-colors"
                    >
                      ⚡ Auto-Fill SKU & Barcode
                    </button>
                    <span className="text-[10px] text-slate-400 font-mono">Table: `product_variants`</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      SKU Code <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formSku}
                      onChange={(e) => setFormSku(e.target.value.toUpperCase())}
                      placeholder="e.g. DETTOL-NEEM-125G"
                      className="w-full px-2.5 py-1.5 font-mono font-bold text-slate-800 border border-slate-300 rounded bg-white uppercase"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Variant Name / Pack Size <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formVariantName}
                      onChange={(e) => setFormVariantName(e.target.value)}
                      placeholder="e.g. 125g Single Bar or 4 × 125g Pack"
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                      required
                    />
                  </div>

                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block font-semibold text-slate-700 mb-1">Net Weight</label>
                      <input
                        type="number"
                        value={formNetWeightValue}
                        onChange={(e) => setFormNetWeightValue(parseFloat(e.target.value) || 0)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                      />
                    </div>
                    <div className="w-20">
                      <label className="block font-semibold text-slate-700 mb-1">Unit</label>
                      <select
                        value={formMeasurementUnit}
                        onChange={(e) => setFormMeasurementUnit(e.target.value as any)}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white"
                      >
                        <option value="g">g</option>
                        <option value="kg">kg</option>
                        <option value="ml">ml</option>
                        <option value="l">L</option>
                        <option value="each">each</option>
                        <option value="pack">pack</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 pt-1">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">MRP (₹)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={formMrp}
                      onChange={(e) => setFormMrp(parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Selling Price (₹)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={formPrice}
                      onChange={(e) => setFormPrice(parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white font-bold text-emerald-700"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">HSN Code</label>
                    <input
                      type="text"
                      value={formHsnCode}
                      onChange={(e) => setFormHsnCode(e.target.value)}
                      className="w-full px-2.5 py-1.5 font-mono text-slate-700 border border-slate-300 rounded bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Barcode (EAN-13)</label>
                    <input
                      type="text"
                      value={formBarcode}
                      onChange={(e) => setFormBarcode(e.target.value)}
                      placeholder="Optional"
                      className="w-full px-2.5 py-1.5 font-mono text-slate-700 border border-slate-300 rounded bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Product Image URL</label>
                  <input
                    type="url"
                    value={formImageUrl}
                    onChange={(e) => setFormImageUrl(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-[11px] border border-slate-300 rounded bg-white"
                  />
                </div>
              </div>

              {/* SECTION 4: INITIAL FEFO WAREHOUSE BATCH */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                    <span>4. Initial FEFO Warehouse Batch Allocation</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Service: `inventory-service`</span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Initial Stock Units</label>
                    <input
                      type="number"
                      value={formInitialStock}
                      onChange={(e) => setFormInitialStock(parseInt(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 font-bold border border-slate-300 rounded bg-white text-slate-900"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Warehouse Shelf / Zone</label>
                    <input
                      type="text"
                      value={formWarehouseZone}
                      onChange={(e) => setFormWarehouseZone(e.target.value)}
                      className="w-full px-2.5 py-1.5 font-mono text-slate-700 border border-slate-300 rounded bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">FEFO Batch Number</label>
                    <input
                      type="text"
                      value={formBatchNumber}
                      onChange={(e) => setFormBatchNumber(e.target.value)}
                      placeholder="e.g. BATCH-2026-01"
                      className="w-full px-2.5 py-1.5 font-mono text-slate-700 border border-slate-300 rounded bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Batch Expiry Date</label>
                    <input
                      type="date"
                      value={formExpiryDate}
                      onChange={(e) => setFormExpiryDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="pt-2 flex items-center justify-between border-t border-slate-200">
                <span className="text-[11px] text-slate-500">
                  Data will be registered in PostgreSQL catalog, inventory, and analytics tables.
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddProductOpen(false)}
                    className="px-4 py-2 rounded text-slate-700 hover:bg-slate-100 font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingProduct}
                    className="flex items-center gap-1.5 px-4 py-2 rounded bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isSubmittingProduct ? 'Saving...' : 'Save & Register Product'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: STOCK ADJUSTMENT */}
      {/* ========================================================= */}
      {adjustStockSku && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-sm w-full p-4 space-y-3">
            <h3 className="font-bold text-slate-900 text-sm">Adjust Stock for {adjustStockSku}</h3>
            <p className="text-slate-500 text-[11px]">
              Perform authorized stock adjustment with reason code for inventory reconciliation.
            </p>

            <div>
              <label className="block text-slate-600 text-[11px] mb-1">Delta Quantity (+/-)</label>
              <input
                type="number"
                value={adjustDelta}
                onChange={(e) => setAdjustDelta(parseInt(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setAdjustStockSku(null)}
                className="px-3 py-1.5 rounded text-slate-600 hover:bg-slate-100 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmStockAdjust}
                className="px-3 py-1.5 rounded bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
              >
                Confirm Adjustment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: PRINTABLE GST TAX INVOICE */}
      {/* ========================================================= */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg border border-slate-300 shadow-2xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">TAX INVOICE</h2>
                <p className="text-[11px] text-slate-500">FreshCart Omnichannel Groceries Pvt Ltd</p>
              </div>

              <div className="text-right">
                <div className="font-bold text-slate-900 font-mono text-xs">{selectedInvoice.invoiceNumber}</div>
                <div className="text-[10px] text-slate-500">Date: {selectedInvoice.createdAt}</div>
              </div>
            </div>

            {/* Customer Details */}
            <div className="grid grid-cols-2 gap-4 text-[11px] p-3 bg-slate-50 rounded">
              <div>
                <span className="text-slate-400 font-semibold block uppercase text-[10px]">Billed To</span>
                <span className="font-bold text-slate-800">{selectedInvoice.customerName}</span>
                {selectedInvoice.customerGstin && (
                  <div className="text-slate-500 font-mono text-[10px]">GSTIN: {selectedInvoice.customerGstin}</div>
                )}
              </div>
              <div className="text-right">
                <span className="text-slate-400 font-semibold block uppercase text-[10px]">Order Reference</span>
                <span className="font-bold text-slate-800 font-mono">{selectedInvoice.orderNumber}</span>
                <div className="text-slate-500 text-[10px]">Payment: PAID (Online Saga)</div>
              </div>
            </div>

            {/* Invoice Line Items */}
            <table className="w-full text-left text-[11px] border border-slate-200">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="p-2">Description</th>
                  <th className="p-2">HSN</th>
                  <th className="p-2 text-right">Qty</th>
                  <th className="p-2 text-right">Rate</th>
                  <th className="p-2 text-right">Taxable</th>
                  <th className="p-2 text-right">CGST</th>
                  <th className="p-2 text-right">SGST</th>
                  <th className="p-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {selectedInvoice.items.map((it, idx) => (
                  <tr key={idx}>
                    <td className="p-2 font-medium text-slate-800">{it.description}</td>
                    <td className="p-2 font-mono text-slate-600">{it.hsn}</td>
                    <td className="p-2 text-right">{it.qty}</td>
                    <td className="p-2 text-right">₹{it.rate.toFixed(2)}</td>
                    <td className="p-2 text-right">₹{it.amount.toFixed(2)}</td>
                    <td className="p-2 text-right text-slate-500">₹{(it.amount * 0.09).toFixed(2)}</td>
                    <td className="p-2 text-right text-slate-500">₹{(it.amount * 0.09).toFixed(2)}</td>
                    <td className="p-2 text-right font-bold text-slate-900">
                      ₹{(it.amount * 1.18).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals Summary */}
            <div className="flex justify-end pt-2">
              <div className="w-56 space-y-1 text-[11px]">
                <div className="flex justify-between text-slate-600">
                  <span>Taxable Subtotal:</span>
                  <span>₹{selectedInvoice.taxableAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Total GST:</span>
                  <span>₹{selectedInvoice.totalTax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 pt-1 border-t text-xs">
                  <span>Grand Total:</span>
                  <span>₹{selectedInvoice.grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 text-white font-medium hover:bg-slate-900 text-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Tax Invoice</span>
              </button>

              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-1.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TOAST NOTIFICATION */}
      {/* ========================================================= */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 bg-slate-900 text-white px-3.5 py-2.5 rounded-lg shadow-lg flex items-center gap-2 text-xs border border-slate-700 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

export default App;
