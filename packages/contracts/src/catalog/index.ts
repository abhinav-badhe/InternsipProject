export type MeasurementUnit = 'g' | 'kg' | 'ml' | 'l' | 'each' | 'pack';
export type StorageType = 'ambient' | 'chilled' | 'frozen';
export type VariantStatus = 'draft' | 'active' | 'discontinued';

export interface Category {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  aliases: string[];
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Product {
  id: string;
  brandId: string | null;
  primaryCategoryId: string;
  name: string;
  slug: string;
  description?: string;
  isPerishable: boolean;
  storageType: StorageType;
  shelfLifeDays?: number;
  isVeg: boolean;
  tags: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  barcode?: string;
  variantName: string;
  netWeightValue: number;
  measurementUnit: MeasurementUnit;
  imageUrls: string[];
  status: VariantStatus;
  createdAt: string;
  updatedAt: string;
}

export interface VariantAttribute {
  id: string;
  variantId: string;
  attributeName: string;
  attributeValue: string;
}

/** Full composite product detail returned by Catalog Service */
export interface ProductDetail extends Product {
  brand?: Brand;
  category?: Category;
  variants: ProductVariant[];
}

/** Category disambiguation result when a search term spans multiple categories (e.g. "soap") */
export interface CategoryDisambiguationResult {
  query: string;
  isAmbiguous: boolean;
  matchingCategories: Array<{
    id: string;
    name: string;
    slug: string;
    sampleBrands: string[];
  }>;
}

/** Out-of-stock similar product suggestion payload */
export interface SimilarProductSuggestion {
  requestedSku: string;
  requestedProductName: string;
  inStockAlternatives: Array<{
    variant: ProductVariant;
    productName: string;
    brandName?: string;
    storageType: StorageType;
    netWeight: string;
    indicativePrice?: number;
  }>;
}
