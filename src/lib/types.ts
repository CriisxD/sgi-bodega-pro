// ============================================================
// SGI Bodega Pro — TypeScript Types
// ============================================================

export type UserRole = 'admin' | 'bodeguero' | 'supervisor' | 'prevencionista';

export type ValeType = 'epp' | 'material' | 'cargo_personal' | 'uso_diario';

export type ValeStatus = 'pendiente' | 'procesado' | 'cancelado';

export type ProductCategory = 'epp' | 'material' | 'herramienta' | 'consumible' | 'aseo';

export type EppZone = 'cabeza' | 'manos' | 'cuerpo' | 'pies' | 'otros';

export type ToolAssignmentStatus = 'activo' | 'devuelto' | 'pendiente';

export type StockMovementType = 'entrada' | 'salida';

// ============================================================
// Database row types
// ============================================================

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  area: string | null;
  active: boolean;
  created_at: string;
}

export interface Worker {
  id: string;
  rut: string;
  name: string;
  position: string;
  area: string;
  active: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  type: ProductCategory;
}

export interface Product {
  id: string;
  name: string;
  brand: string | null;
  category_id: string;
  stock: number;
  min_stock: number;
  unit: string;
  zone: EppZone | null;
  active: boolean;
  created_at: string;
  // Joined
  category?: Category;
}

export interface Vale {
  id: string;
  vale_number: number;
  type: ValeType;
  status: ValeStatus;
  created_by: string;
  worker_id: string;
  notes: string | null;
  vale_date: string;
  created_at: string;
  processed_at: string | null;
  processed_by: string | null;
  // Joined
  worker?: Worker;
  creator?: Profile;
  processor?: Profile;
  signature?: string;
  items?: ValeItem[];
}

export interface ValeItem {
  id: string;
  vale_id: string;
  product_id: string;
  quantity: number;
  quantity_delivered: number;
  // Joined
  product?: Product;
}

export interface EppRecord {
  id: string;
  worker_id: string;
  product_id: string;
  vale_id: string;
  quantity: number;
  delivered_at: string;
  authorized_by: string;
  processed_by: string;
  // Joined
  worker?: Worker;
  product?: Product;
  authorizer?: Profile;
  processor?: Profile;
}

export interface ToolAssignment {
  id: string;
  worker_id: string;
  product_id: string;
  vale_id: string;
  assigned_at: string;
  returned_at: string | null;
  status: ToolAssignmentStatus;
  condition_notes: string | null;
  // Joined
  worker?: Worker;
  product?: Product;
}

export interface StockMovement {
  id: string;
  product_id: string;
  type: StockMovementType;
  quantity: number;
  reference_type: string;
  reference_id: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  // Joined
  product?: Product;
  creator?: Profile;
}

export interface Reception {
  id: string;
  supplier: string;
  supplier_rut: string | null;
  supplier_name: string | null;
  invoice: string | null;
  invoice_date: string | null;
  document_type: string | null;
  net_amount: number;
  iva_amount: number;
  total_amount: number;
  received_by: string;
  notes: string | null;
  created_at: string;
  // Joined
  items?: ReceptionItem[];
  receiver?: Profile;
}

export interface ReceptionItem {
  id: string;
  reception_id: string;
  product_id: string;
  quantity: number;
  unit_price: number | null;
  // Joined
  product?: Product;
}

// ============================================================
// UI / Navigation types
// ============================================================

export interface NavItem {
  title: string;
  href: string;
  icon: string;
  roles: UserRole[];
  badge?: number;
}

export interface StatsCard {
  title: string;
  value: string | number;
  description?: string;
  icon: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}
