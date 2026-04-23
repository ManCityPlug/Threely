export type ProductNiche =
  | "fitness"
  | "beauty"
  | "tech_accessories"
  | "home_decor"
  | "pet"
  | "kids"
  | "eco"
  | "wellness";

export interface ProductImage {
  variant: string; // e.g., "lifestyle_1", "product_white"
  url: string;     // placeholder unsplash URLs are fine for v1
  alt: string;
}

export interface Product {
  id: string;
  title: string;
  niches: ProductNiche[];       // can belong to multiple niches
  supplier_cost: number;         // USD
  suggested_retail: number;      // USD
  why_it_sells: string;         // 1-2 sentence pitch
  tags: string[];                // e.g., ["trending", "gift", "wfh"]
  image_variants: ProductImage[]; // 3-6 images per product
  ad_prompt_templates: string[]; // 3-5 image-gen prompts for ad creatives
}
