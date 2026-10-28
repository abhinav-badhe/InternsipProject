export interface ProductVariant {
  sku: string;
  name: string;
  packSize: string;
  price: number;
  mrp: number;
  availableStock: number;
  imageUrl: string;
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  categoryId: string;
  categoryName: string;
  description: string;
  rating: number;
  reviewCount: number;
  variants: ProductVariant[];
}

export interface Category {
  id: string;
  name: string;
  shortLabel: string;
  slug: string;
  iconName: string;
}

export const CATEGORIES: Category[] = [
  { id: 'ALL', name: 'All Products', shortLabel: 'All', slug: 'all', iconName: 'LayoutGrid' },
  { id: 'BATH_SOAP', name: 'Bathing Soaps & Body Wash', shortLabel: 'Bathing', slug: 'bathing', iconName: 'Sparkles' },
  { id: 'WASH_SOAP', name: 'Laundry Bars & Detergents', shortLabel: 'Laundry', slug: 'laundry', iconName: 'Shirt' },
  { id: 'UTENSIL_SOAP', name: 'Dishwash Bars & Liquids', shortLabel: 'Dishwash', slug: 'dishwash', iconName: 'Utensils' },
  { id: 'DAIRY_BAKERY', name: 'Dairy, Bread & Eggs', shortLabel: 'Dairy', slug: 'dairy', iconName: 'Milk' },
  { id: 'STAPLES', name: 'Atta, Rice & Grains', shortLabel: 'Staples', slug: 'staples', iconName: 'Wheat' },
];

export const PRODUCTS: Product[] = [
  // 1. Bathing Soaps
  {
    id: 'prod-dettol-orig',
    name: 'Dettol Original Germ Protection Bathing Soap',
    brand: 'Dettol',
    categoryId: 'BATH_SOAP',
    categoryName: 'Bathing Soaps & Body Wash',
    description: 'Trusted antibacterial protection with pine fragrance for everyday family hygiene.',
    rating: 4.8,
    reviewCount: 1420,
    variants: [
      {
        sku: 'DETTOL-ORIG-75G',
        name: 'Single Bar (75g)',
        packSize: '75g',
        price: 38.0,
        mrp: 42.0,
        availableStock: 45,
        imageUrl: 'https://images.unsplash.com/photo-1607006314144-8d9106fb3c9c?w=500&auto=format&fit=crop&q=80',
      },
      {
        sku: 'DETTOL-ORIG-125G',
        name: 'Single Bar (125g)',
        packSize: '125g',
        price: 58.0,
        mrp: 65.0,
        availableStock: 28,
        imageUrl: 'https://images.unsplash.com/photo-1607006314144-8d9106fb3c9c?w=500&auto=format&fit=crop&q=80',
      },
      {
        sku: 'DETTOL-ORIG-4PK',
        name: 'Value Saver Pack (4 x 125g)',
        packSize: '4 x 125g',
        price: 215.0,
        mrp: 260.0,
        availableStock: 12,
        imageUrl: 'https://images.unsplash.com/photo-1607006314144-8d9106fb3c9c?w=500&auto=format&fit=crop&q=80',
      },
    ],
  },
  {
    id: 'prod-dove-bar',
    name: 'Dove Cream Beauty Bathing Bar with Moisturizing Milk',
    brand: 'Dove',
    categoryId: 'BATH_SOAP',
    categoryName: 'Bathing Soaps & Body Wash',
    description: 'Formulated with 1/4th moisturizing cream to leave skin visibly softer and smoother.',
    rating: 4.9,
    reviewCount: 2310,
    variants: [
      {
        sku: 'DOVE-BAR-75G',
        name: 'Single Bar (75g)',
        packSize: '75g',
        price: 54.0,
        mrp: 62.0,
        availableStock: 30,
        imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=80',
      },
      {
        sku: 'DOVE-BAR-125G-4PK',
        name: 'Value Pack (4 x 125g)',
        packSize: '4 x 125g',
        price: 295.0,
        mrp: 340.0,
        availableStock: 1, // Scenario 1 trigger: Only 1 unit remaining!
        imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=80',
      },
    ],
  },
  {
    id: 'prod-lifebuoy-total',
    name: 'Lifebuoy Total 10 Germ Protection Soap',
    brand: 'Lifebuoy',
    categoryId: 'BATH_SOAP',
    categoryName: 'Bathing Soaps & Body Wash',
    description: 'Advanced Silver Shield formula provides 100% stronger germ protection.',
    rating: 4.6,
    reviewCount: 940,
    variants: [
      {
        sku: 'LIFEBUOY-RED-100G',
        name: 'Single Bar (100g)',
        packSize: '100g',
        price: 32.0,
        mrp: 36.0,
        availableStock: 0, // Out of stock example for substitution demo!
        imageUrl: 'https://images.unsplash.com/photo-1594913785162-e678a0c23dd9?w=500&auto=format&fit=crop&q=80',
      },
      {
        sku: 'LIFEBUOY-RED-4PK',
        name: 'Multipack (4 x 100g)',
        packSize: '4 x 100g',
        price: 120.0,
        mrp: 144.0,
        availableStock: 18,
        imageUrl: 'https://images.unsplash.com/photo-1594913785162-e678a0c23dd9?w=500&auto=format&fit=crop&q=80',
      },
    ],
  },

  // 2. Washing / Laundry Soaps
  {
    id: 'prod-surf-bar',
    name: 'Surf Excel Stain Eraser Detergent Bar',
    brand: 'Surf Excel',
    categoryId: 'WASH_SOAP',
    categoryName: 'Laundry Bars & Detergents',
    description: 'Removes tough stains from cuffs, collars, and underarms with minimal scrubbing.',
    rating: 4.8,
    reviewCount: 1890,
    variants: [
      {
        sku: 'SURF-BAR-200G',
        name: 'Single Bar (200g)',
        packSize: '200g',
        price: 30.0,
        mrp: 35.0,
        availableStock: 50,
        imageUrl: 'https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?w=500&auto=format&fit=crop&q=80',
      },
      {
        sku: 'SURF-BAR-800G-4PK',
        name: 'Value Saver Pack (4 x 200g)',
        packSize: '4 x 200g',
        price: 112.0,
        mrp: 130.0,
        availableStock: 25,
        imageUrl: 'https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?w=500&auto=format&fit=crop&q=80',
      },
    ],
  },
  {
    id: 'prod-rin-bar',
    name: 'Rin Advanced Supreme Brightness Detergent Bar',
    brand: 'Rin',
    categoryId: 'WASH_SOAP',
    categoryName: 'Laundry Bars & Detergents',
    description: 'Infused with bright-clean crystals that ensure whites stay exceptionally bright.',
    rating: 4.7,
    reviewCount: 1120,
    variants: [
      {
        sku: 'RIN-BAR-250G',
        name: 'Single Bar (250g)',
        packSize: '250g',
        price: 24.0,
        mrp: 28.0,
        availableStock: 60,
        imageUrl: 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?w=500&auto=format&fit=crop&q=80',
      },
    ],
  },

  // 3. Utensil / Dishwash Soaps
  {
    id: 'prod-vim-bar',
    name: 'Vim Lemon Degreasing Dishwash Bar',
    brand: 'Vim',
    categoryId: 'UTENSIL_SOAP',
    categoryName: 'Dishwash Bars & Liquids',
    description: 'Power of 100 lemons cuts through burnt grease and tough oil stains effortlessly.',
    rating: 4.9,
    reviewCount: 3400,
    variants: [
      {
        sku: 'VIM-BAR-200G',
        name: 'Single Bar with Waterproof Tub (200g)',
        packSize: '200g',
        price: 25.0,
        mrp: 28.0,
        availableStock: 40,
        imageUrl: 'https://images.unsplash.com/photo-1585670210693-e7fdd16b142e?w=500&auto=format&fit=crop&q=80',
      },
      {
        sku: 'VIM-BAR-500G',
        name: 'Jumbo Saver Bar (500g)',
        packSize: '500g',
        price: 55.0,
        mrp: 62.0,
        availableStock: 22,
        imageUrl: 'https://images.unsplash.com/photo-1585670210693-e7fdd16b142e?w=500&auto=format&fit=crop&q=80',
      },
    ],
  },
  {
    id: 'prod-pril-liquid',
    name: 'Pril Lime Degreaser Dishwashing Gel',
    brand: 'Pril',
    categoryId: 'UTENSIL_SOAP',
    categoryName: 'Dishwash Bars & Liquids',
    description: 'Concentrated gel with active molecules that dissolve sticky gravy and burnt milk.',
    rating: 4.8,
    reviewCount: 1450,
    variants: [
      {
        sku: 'PRIL-GEL-425ML',
        name: 'Squeeze Bottle (425ml)',
        packSize: '425ml',
        price: 110.0,
        mrp: 125.0,
        availableStock: 15,
        imageUrl: 'https://images.unsplash.com/photo-1585670210693-e7fdd16b142e?w=500&auto=format&fit=crop&q=80',
      },
    ],
  },

  // 4. Dairy & Bakery
  {
    id: 'prod-amul-milk',
    name: 'Amul Taaza Homogenised Toned Milk',
    brand: 'Amul',
    categoryId: 'DAIRY_BAKERY',
    categoryName: 'Dairy, Bread & Eggs',
    description: 'Pasteurized toned milk with 3.0% fat and 8.5% SNF. Wholesome and fresh daily.',
    rating: 4.9,
    reviewCount: 4200,
    variants: [
      {
        sku: 'AMUL-MILK-1L',
        name: 'Tetra Pak (1L)',
        packSize: '1L',
        price: 74.0,
        mrp: 75.0,
        availableStock: 35,
        imageUrl: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=500&auto=format&fit=crop&q=80',
      },
    ],
  },
  {
    id: 'prod-amul-butter',
    name: 'Amul Pasteurised Salted Butter',
    brand: 'Amul',
    categoryId: 'DAIRY_BAKERY',
    categoryName: 'Dairy, Bread & Eggs',
    description: 'The iconic Utterly Butterly Delicious Indian table butter.',
    rating: 4.9,
    reviewCount: 5120,
    variants: [
      {
        sku: 'AMUL-BTR-100G',
        name: 'Block (100g)',
        packSize: '100g',
        price: 58.0,
        mrp: 60.0,
        availableStock: 50,
        imageUrl: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=500&auto=format&fit=crop&q=80',
      },
      {
        sku: 'AMUL-BTR-500G',
        name: 'Block (500g)',
        packSize: '500g',
        price: 275.0,
        mrp: 285.0,
        availableStock: 19,
        imageUrl: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=500&auto=format&fit=crop&q=80',
      },
    ],
  },

  // 5. Staples
  {
    id: 'prod-aashirvaad-atta',
    name: 'Aashirvaad Shudh Chakki Whole Wheat Atta',
    brand: 'Aashirvaad',
    categoryId: 'STAPLES',
    categoryName: 'Atta, Rice & Grains',
    description: '100% whole wheat grains ground to perfection for soft, fluffy rotis.',
    rating: 4.9,
    reviewCount: 3890,
    variants: [
      {
        sku: 'AASH-ATTA-5KG',
        name: 'Bag (5kg)',
        packSize: '5kg',
        price: 245.0,
        mrp: 275.0,
        availableStock: 25,
        imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&auto=format&fit=crop&q=80',
      },
      {
        sku: 'AASH-ATTA-10KG',
        name: 'Bag (10kg)',
        packSize: '10kg',
        price: 460.0,
        mrp: 520.0,
        availableStock: 14,
        imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&auto=format&fit=crop&q=80',
      },
    ],
  },
  {
    id: 'prod-daawat-rice',
    name: 'Daawat Rozana Super Basmati Rice',
    brand: 'Daawat',
    categoryId: 'STAPLES',
    categoryName: 'Atta, Rice & Grains',
    description: 'Aromatic long-grain basmati rice aged to perfection for everyday meals.',
    rating: 4.8,
    reviewCount: 2100,
    variants: [
      {
        sku: 'DAAWAT-RICE-5KG',
        name: 'Bag (5kg)',
        packSize: '5kg',
        price: 380.0,
        mrp: 450.0,
        availableStock: 16,
        imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500&auto=format&fit=crop&q=80',
      },
    ],
  },
];
