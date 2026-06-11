-- ============================================================
-- SGI Bodega Pro — Database Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum Types
CREATE TYPE user_role AS ENUM ('admin', 'bodeguero', 'supervisor', 'prevencionista');
CREATE TYPE vale_type AS ENUM ('epp', 'material', 'cargo_personal', 'uso_diario');
CREATE TYPE vale_status AS ENUM ('pendiente', 'procesado', 'cancelado');
CREATE TYPE product_type AS ENUM ('epp', 'material', 'herramienta', 'consumible', 'aseo');
CREATE TYPE epp_zone AS ENUM ('cabeza', 'manos', 'cuerpo', 'pies', 'otros');
CREATE TYPE assignment_status AS ENUM ('activo', 'devuelto', 'pendiente');
CREATE TYPE movement_type AS ENUM ('entrada', 'salida');

-- ============================================================
-- Tables
-- ============================================================

-- User Profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role user_role NOT NULL,
  area TEXT, -- Used for supervisor filtering
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workers
CREATE TABLE workers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rut TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  position TEXT NOT NULL,
  area TEXT NOT NULL, -- Used to filter which workers a supervisor can see
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Categories
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type product_type NOT NULL
);

-- Products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE RESTRICT,
  stock NUMERIC NOT NULL DEFAULT 0,
  min_stock NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'un',
  zone epp_zone,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vales
CREATE TABLE vales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vale_number SERIAL UNIQUE,
  type vale_type NOT NULL,
  status vale_status NOT NULL DEFAULT 'pendiente',
  created_by UUID REFERENCES profiles(id) ON DELETE RESTRICT,
  worker_id UUID REFERENCES workers(id) ON DELETE RESTRICT,
  notes TEXT,
  vale_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- Vale Items
CREATE TABLE vale_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vale_id UUID REFERENCES vales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
  quantity NUMERIC NOT NULL,
  quantity_delivered NUMERIC DEFAULT 0
);

-- EPP Records (Legal delivery log)
CREATE TABLE epp_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id UUID REFERENCES workers(id) ON DELETE RESTRICT,
  product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
  vale_id UUID REFERENCES vales(id) ON DELETE SET NULL,
  quantity NUMERIC NOT NULL,
  delivered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  authorized_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  processed_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- Tool Assignments (Cargo personal & Uso diario)
CREATE TABLE tool_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id UUID REFERENCES workers(id) ON DELETE RESTRICT,
  product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
  vale_id UUID REFERENCES vales(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  returned_at TIMESTAMP WITH TIME ZONE,
  status assignment_status NOT NULL DEFAULT 'activo',
  condition_notes TEXT
);

-- Stock Movements (Audit log)
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
  type movement_type NOT NULL,
  quantity NUMERIC NOT NULL,
  reference_type TEXT NOT NULL, -- 'vale', 'reception', 'adjustment'
  reference_id UUID,
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Receptions (Ingreso de mercadería)
CREATE TABLE receptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier TEXT NOT NULL,
  invoice TEXT,
  received_by UUID REFERENCES profiles(id) ON DELETE RESTRICT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE reception_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reception_id UUID REFERENCES receptions(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
  quantity NUMERIC NOT NULL
);

-- ============================================================
-- RPC Functions
-- ============================================================

-- Safely decrease stock
CREATE OR REPLACE FUNCTION decrease_stock(p_product_id UUID, p_quantity NUMERIC)
RETURNS void AS $$
BEGIN
  UPDATE products
  SET stock = stock - p_quantity
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql;

-- Safely increase stock
CREATE OR REPLACE FUNCTION increase_stock(p_product_id UUID, p_quantity NUMERIC)
RETURNS void AS $$
BEGIN
  UPDATE products
  SET stock = stock + p_quantity
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Row Level Security (RLS)
-- Note: Setting basic RLS for security rules
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE vales ENABLE ROW LEVEL SECURITY;
ALTER TABLE vale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE epp_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE receptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reception_items ENABLE ROW LEVEL SECURITY;

-- Temporary: Allow all access for authenticated users to start quickly
-- In production, these should be locked down per role
CREATE POLICY "Allow all actions for authenticated users" ON profiles FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all actions for authenticated users" ON workers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all actions for authenticated users" ON categories FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all actions for authenticated users" ON products FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all actions for authenticated users" ON vales FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all actions for authenticated users" ON vale_items FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all actions for authenticated users" ON epp_records FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all actions for authenticated users" ON tool_assignments FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all actions for authenticated users" ON stock_movements FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all actions for authenticated users" ON receptions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all actions for authenticated users" ON reception_items FOR ALL USING (auth.role() = 'authenticated');

-- Also create triggers to automatically add users to profiles when they sign up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'full_name', 'Nuevo Usuario'), 
    COALESCE((new.raw_user_meta_data->>'role')::user_role, 'bodeguero')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
