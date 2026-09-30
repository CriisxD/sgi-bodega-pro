-- ============================================================
-- SGI Bodega Pro — Instalación completa para un proyecto Supabase NUEVO
-- Generado a partir de los .sql del repo, en orden. Pegar entero en el SQL Editor y ejecutar una vez.
-- No usar sobre una base existente: para esa, ejecutar solo las migraciones que falten.
-- ============================================================

-- >>>>>>>>>> schema.sql <<<<<<<<<<
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
-- Políticas por rol basadas en profiles.role (ver helpers get_user_role/get_user_area)
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

-- Políticas por rol (ver supabase/migrations/rls_por_rol.sql para la matriz
-- completa; fuel_records/fuel_receptions se configuran en esa migración).

-- ------------------------------------------------------------
-- 1. Funciones helper
-- ------------------------------------------------------------
-- SECURITY DEFINER para que puedan leer profiles/workers sin pasar por RLS
-- (evita recursión infinita en las políticas de profiles).

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles
  WHERE id = auth.uid() AND COALESCE(active, true);
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_user_area()
RETURNS text AS $$
  SELECT area FROM public.profiles
  WHERE id = auth.uid() AND COALESCE(active, true);
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- true si el trabajador pertenece al área del usuario actual
CREATE OR REPLACE FUNCTION public.is_worker_in_my_area(p_worker_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workers w
    WHERE w.id = p_worker_id
      AND w.area = public.get_user_area()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Siguiente número de vale calculado sobre TODOS los vales. Necesario porque
-- supervisor solo ve los vales de su área, y calcular max+1 desde el cliente
-- generaría números repetidos (vale_number es UNIQUE).
CREATE OR REPLACE FUNCTION public.next_vale_number()
RETURNS integer AS $$
BEGIN
  IF public.get_user_role() IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  RETURN COALESCE((SELECT MAX(vale_number) FROM public.vales), 2000) + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.next_vale_number() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_vale_number() TO authenticated;

-- ------------------------------------------------------------
-- 2. Proteger columnas privilegiadas de profiles
-- ------------------------------------------------------------
-- La política de UPDATE deja a cada usuario editar su propia fila (perfil →
-- full_name). Sin este trigger, un bodeguero podría hacer
-- update profiles set role = 'admin' where id = auth.uid().
-- Las llamadas con service role (auth.uid() nulo) no se ven afectadas.

CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS trigger AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND public.get_user_role() IS DISTINCT FROM 'admin'
     AND (NEW.id     IS DISTINCT FROM OLD.id
       OR NEW.role   IS DISTINCT FROM OLD.role
       OR NEW.area   IS DISTINCT FROM OLD.area
       OR NEW.active IS DISTINCT FROM OLD.active
       OR NEW.email  IS DISTINCT FROM OLD.email)
  THEN
    RAISE EXCEPTION 'Solo un administrador puede modificar rol, área, estado o email';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS protect_profile_privileged_columns ON public.profiles;
CREATE TRIGGER protect_profile_privileged_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileged_columns();

-- ------------------------------------------------------------
-- 3. Políticas
-- ------------------------------------------------------------
-- (SELECT get_user_role()) va envuelto en SELECT para que Postgres lo evalúe
-- una sola vez por consulta y no por fila.

-- profiles ---------------------------------------------------
-- Todo el personal activo puede leer perfiles: la app muestra el nombre de
-- quien creó/procesó vales, recepciones y movimientos (joins a profiles).
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR (SELECT get_user_role()) IS NOT NULL);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR (SELECT get_user_role()) = 'admin')
  WITH CHECK (id = auth.uid() OR (SELECT get_user_role()) = 'admin');
CREATE POLICY "profiles_insert_admin" ON profiles FOR INSERT TO authenticated
  WITH CHECK ((SELECT get_user_role()) = 'admin');
CREATE POLICY "profiles_delete_admin" ON profiles FOR DELETE TO authenticated
  USING ((SELECT get_user_role()) = 'admin');

-- workers ----------------------------------------------------
CREATE POLICY "workers_select" ON workers FOR SELECT TO authenticated
  USING (
    (SELECT get_user_role()) IN ('admin', 'bodeguero', 'prevencionista')
    OR ((SELECT get_user_role()) = 'supervisor' AND area = (SELECT get_user_area()))
  );
-- prevencionista/supervisor crean trabajadores desde "Nuevo Vale"
CREATE POLICY "workers_insert" ON workers FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT get_user_role()) IN ('admin', 'bodeguero', 'prevencionista')
    OR ((SELECT get_user_role()) = 'supervisor' AND area = (SELECT get_user_area()))
  );
CREATE POLICY "workers_update" ON workers FOR UPDATE TO authenticated
  USING ((SELECT get_user_role()) IN ('admin', 'bodeguero'))
  WITH CHECK ((SELECT get_user_role()) IN ('admin', 'bodeguero'));
CREATE POLICY "workers_delete" ON workers FOR DELETE TO authenticated
  USING ((SELECT get_user_role()) IN ('admin', 'bodeguero'));

-- categories -------------------------------------------------
CREATE POLICY "categories_select" ON categories FOR SELECT TO authenticated
  USING ((SELECT get_user_role()) IS NOT NULL);
CREATE POLICY "categories_write" ON categories FOR ALL TO authenticated
  USING ((SELECT get_user_role()) IN ('admin', 'bodeguero'))
  WITH CHECK ((SELECT get_user_role()) IN ('admin', 'bodeguero'));

-- products ---------------------------------------------------
-- decrease_stock/increase_stock son SECURITY INVOKER: solo funcionan para
-- quien tenga UPDATE aquí (admin y bodeguero).
CREATE POLICY "products_select" ON products FOR SELECT TO authenticated
  USING ((SELECT get_user_role()) IS NOT NULL);
CREATE POLICY "products_write" ON products FOR ALL TO authenticated
  USING ((SELECT get_user_role()) IN ('admin', 'bodeguero'))
  WITH CHECK ((SELECT get_user_role()) IN ('admin', 'bodeguero'));

-- vales ------------------------------------------------------
CREATE POLICY "vales_select" ON vales FOR SELECT TO authenticated
  USING (
    (SELECT get_user_role()) IN ('admin', 'bodeguero', 'prevencionista')
    OR ((SELECT get_user_role()) = 'supervisor'
        AND (created_by = auth.uid() OR is_worker_in_my_area(worker_id)))
  );
CREATE POLICY "vales_insert" ON vales FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT get_user_role()) IN ('admin', 'bodeguero')
    OR ((SELECT get_user_role()) = 'prevencionista'
        AND created_by = auth.uid()
        AND status = 'pendiente'
        AND type IN ('epp', 'cargo_personal', 'uso_diario'))
    OR ((SELECT get_user_role()) = 'supervisor'
        AND created_by = auth.uid()
        AND status = 'pendiente'
        AND type = 'material'
        AND is_worker_in_my_area(worker_id))
  );
-- Despacho (procesar), edición y eliminación: solo bodega
CREATE POLICY "vales_update" ON vales FOR UPDATE TO authenticated
  USING ((SELECT get_user_role()) IN ('admin', 'bodeguero'))
  WITH CHECK ((SELECT get_user_role()) IN ('admin', 'bodeguero'));
CREATE POLICY "vales_delete" ON vales FOR DELETE TO authenticated
  USING ((SELECT get_user_role()) IN ('admin', 'bodeguero'));

-- vale_items -------------------------------------------------
-- Visible si el vale padre es visible (se aplica la RLS de vales).
CREATE POLICY "vale_items_select" ON vale_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM vales v WHERE v.id = vale_items.vale_id));
CREATE POLICY "vale_items_insert" ON vale_items FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT get_user_role()) IN ('admin', 'bodeguero')
    OR ((SELECT get_user_role()) IN ('prevencionista', 'supervisor')
        AND EXISTS (
          SELECT 1 FROM vales v
          WHERE v.id = vale_items.vale_id
            AND v.created_by = auth.uid()
            AND v.status = 'pendiente'
        ))
  );
CREATE POLICY "vale_items_update" ON vale_items FOR UPDATE TO authenticated
  USING ((SELECT get_user_role()) IN ('admin', 'bodeguero'))
  WITH CHECK ((SELECT get_user_role()) IN ('admin', 'bodeguero'));
CREATE POLICY "vale_items_delete" ON vale_items FOR DELETE TO authenticated
  USING ((SELECT get_user_role()) IN ('admin', 'bodeguero'));

-- epp_records ------------------------------------------------
CREATE POLICY "epp_records_select" ON epp_records FOR SELECT TO authenticated
  USING (
    (SELECT get_user_role()) IN ('admin', 'bodeguero', 'prevencionista')
    OR ((SELECT get_user_role()) = 'supervisor' AND is_worker_in_my_area(worker_id))
  );
CREATE POLICY "epp_records_insert" ON epp_records FOR INSERT TO authenticated
  WITH CHECK ((SELECT get_user_role()) IN ('admin', 'bodeguero', 'prevencionista'));
CREATE POLICY "epp_records_update" ON epp_records FOR UPDATE TO authenticated
  USING ((SELECT get_user_role()) IN ('admin', 'bodeguero'))
  WITH CHECK ((SELECT get_user_role()) IN ('admin', 'bodeguero'));
CREATE POLICY "epp_records_delete" ON epp_records FOR DELETE TO authenticated
  USING ((SELECT get_user_role()) IN ('admin', 'bodeguero'));

-- tool_assignments -------------------------------------------
CREATE POLICY "tool_assignments_select" ON tool_assignments FOR SELECT TO authenticated
  USING (
    (SELECT get_user_role()) IN ('admin', 'bodeguero', 'prevencionista')
    OR ((SELECT get_user_role()) = 'supervisor' AND is_worker_in_my_area(worker_id))
  );
CREATE POLICY "tool_assignments_insert" ON tool_assignments FOR INSERT TO authenticated
  WITH CHECK ((SELECT get_user_role()) IN ('admin', 'bodeguero', 'prevencionista'));
-- Préstamos/devoluciones
CREATE POLICY "tool_assignments_update" ON tool_assignments FOR UPDATE TO authenticated
  USING ((SELECT get_user_role()) IN ('admin', 'bodeguero'))
  WITH CHECK ((SELECT get_user_role()) IN ('admin', 'bodeguero'));
CREATE POLICY "tool_assignments_delete" ON tool_assignments FOR DELETE TO authenticated
  USING ((SELECT get_user_role()) IN ('admin', 'bodeguero'));

-- stock_movements (log de auditoría) --------------------------
-- Bodeguero no puede editar movimientos; sí borrarlos porque al eliminar un
-- vale procesado la app revierte su historial.
CREATE POLICY "stock_movements_select" ON stock_movements FOR SELECT TO authenticated
  USING ((SELECT get_user_role()) IN ('admin', 'bodeguero'));
CREATE POLICY "stock_movements_insert" ON stock_movements FOR INSERT TO authenticated
  WITH CHECK ((SELECT get_user_role()) IN ('admin', 'bodeguero'));
CREATE POLICY "stock_movements_update" ON stock_movements FOR UPDATE TO authenticated
  USING ((SELECT get_user_role()) = 'admin')
  WITH CHECK ((SELECT get_user_role()) = 'admin');
CREATE POLICY "stock_movements_delete" ON stock_movements FOR DELETE TO authenticated
  USING ((SELECT get_user_role()) IN ('admin', 'bodeguero'));

-- receptions / reception_items --------------------------------
CREATE POLICY "receptions_bodega" ON receptions FOR ALL TO authenticated
  USING ((SELECT get_user_role()) IN ('admin', 'bodeguero'))
  WITH CHECK ((SELECT get_user_role()) IN ('admin', 'bodeguero'));
CREATE POLICY "reception_items_bodega" ON reception_items FOR ALL TO authenticated
  USING ((SELECT get_user_role()) IN ('admin', 'bodeguero'))
  WITH CHECK ((SELECT get_user_role()) IN ('admin', 'bodeguero'));

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


-- >>>>>>>>>> migrations/externos.sql <<<<<<<<<<
ALTER TABLE workers ADD COLUMN IF NOT EXISTS is_external BOOLEAN DEFAULT false; ALTER TABLE workers ADD COLUMN IF NOT EXISTS company VARCHAR(255);


-- >>>>>>>>>> migrations/pivote2.sql <<<<<<<<<<
-- ============================================================
-- SGI Bodega Pro — Pivote 2 Migration
-- ============================================================

-- 1. Add new statuses to assignment_status enum
-- Note: Postgres does not support 'IF NOT EXISTS' for ADD VALUE inside a transaction block easily,
-- but running this individually in Supabase SQL editor works fine.
ALTER TYPE assignment_status ADD VALUE IF NOT EXISTS 'dado_de_baja';
ALTER TYPE assignment_status ADD VALUE IF NOT EXISTS 'en_mantencion';

-- 2. Create Fuel Records table
CREATE TABLE IF NOT EXISTS fuel_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bodeguero_id UUID REFERENCES profiles(id) ON DELETE RESTRICT,
  receiver_name TEXT NOT NULL,
  receiver_rut TEXT NOT NULL,
  vehicle_type TEXT NOT NULL, -- e.g., 'Camioneta', 'Cargador Frontal', etc.
  liters NUMERIC NOT NULL,
  signature_data TEXT, -- Base64 PNG data of the signature
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE fuel_records ENABLE ROW LEVEL SECURITY;

-- Basic policy for MVP
CREATE POLICY "Allow all actions for authenticated users" ON fuel_records FOR ALL USING (auth.role() = 'authenticated');


-- >>>>>>>>>> migrations/pivote2_fix.sql <<<<<<<<<<
ALTER TABLE fuel_records ADD COLUMN IF NOT EXISTS bodeguero_signature_data TEXT;


-- >>>>>>>>>> add_invoice_fields.sql <<<<<<<<<<
-- Agregar campos de factura a la tabla receptions
ALTER TABLE receptions ADD COLUMN IF NOT EXISTS supplier_rut text;
ALTER TABLE receptions ADD COLUMN IF NOT EXISTS supplier_name text;
ALTER TABLE receptions ADD COLUMN IF NOT EXISTS invoice_date date;
ALTER TABLE receptions ADD COLUMN IF NOT EXISTS net_amount numeric DEFAULT 0;
ALTER TABLE receptions ADD COLUMN IF NOT EXISTS iva_amount numeric DEFAULT 0;
ALTER TABLE receptions ADD COLUMN IF NOT EXISTS total_amount numeric DEFAULT 0;
ALTER TABLE receptions ADD COLUMN IF NOT EXISTS document_type text DEFAULT 'factura';

-- Agregar campo de marca a productos
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand text;

-- document_type puede ser: 'factura', 'guia_despacho', 'boleta', 'nota_credito', 'otro'


-- >>>>>>>>>> migration.sql <<<<<<<<<<
-- Migración para añadir Precio Unitario a las recepciones de bodega
ALTER TABLE reception_items ADD COLUMN IF NOT EXISTS unit_price NUMERIC;


-- >>>>>>>>>> migrations/columnas_faltantes.sql <<<<<<<<<<
-- ============================================================
-- SGI Bodega Pro — Columnas y tablas que la app usa pero no estaban en ningún .sql
-- (se habían creado a mano desde el dashboard). Idempotente.
-- ============================================================

-- Firma del trabajador en el vale (firma por QR y despacho)
ALTER TABLE vales ADD COLUMN IF NOT EXISTS signature TEXT;

-- Préstamos de herramientas (devoluciones)
ALTER TABLE tool_assignments ADD COLUMN IF NOT EXISTS quantity NUMERIC NOT NULL DEFAULT 1;
ALTER TABLE tool_assignments ADD COLUMN IF NOT EXISTS signature TEXT;

-- Llenado del estanque de petróleo
CREATE TABLE IF NOT EXISTS fuel_receptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bodeguero_id UUID REFERENCES profiles(id) ON DELETE RESTRICT,
  liters NUMERIC NOT NULL,
  document_number TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sus políticas se crean en rls_por_rol.sql
ALTER TABLE fuel_receptions ENABLE ROW LEVEL SECURITY;


-- >>>>>>>>>> signature_rls_policies.sql <<<<<<<<<<
-- ============================================================
-- RLS Policies for Mobile QR Signature Flow (Anonymous Access)
-- ============================================================

-- Allow unauthenticated users (anon) to read pending vales
CREATE POLICY "Allow anon read for pending vales" ON vales
  FOR SELECT TO anon
  USING (status = 'pendiente');

-- Allow unauthenticated users (anon) to update pending vales (to upload the signature)
CREATE POLICY "Allow anon update for pending vales" ON vales
  FOR UPDATE TO anon
  USING (status = 'pendiente')
  WITH CHECK (status = 'pendiente');

-- Allow unauthenticated users (anon) to read vale items for pending vales
CREATE POLICY "Allow anon read for pending vale items" ON vale_items
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM vales
      WHERE vales.id = vale_items.vale_id
        AND vales.status = 'pendiente'
    )
  );

-- Allow unauthenticated users (anon) to read workers with pending vales (to show their name)
CREATE POLICY "Allow anon read for workers with pending vales" ON workers
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM vales
      WHERE vales.worker_id = workers.id
        AND vales.status = 'pendiente'
    )
  );

-- Allow unauthenticated users (anon) to read products (to show product names)
CREATE POLICY "Allow anon read for products" ON products
  FOR SELECT TO anon
  USING (true);


-- >>>>>>>>>> migrations/rls_por_rol.sql <<<<<<<<<<
-- ============================================================
-- SGI Bodega Pro — RLS por rol
-- ============================================================
-- Reemplaza las políticas temporales "Allow all actions for authenticated users"
-- por políticas reales según profiles.role.
--
-- Matriz resumida (solo rol `authenticated`; las políticas `anon` del flujo de
-- firma por QR en signature_rls_policies.sql NO se tocan):
--
--   tabla             admin  bodeguero        prevencionista        supervisor (solo su área)
--   profiles          CRUD   leer / editar su fila (sin role/area/active/email)
--   workers           CRUD   CRUD             leer, crear           leer, crear (su área)
--   categories        CRUD   CRUD             leer                  leer
--   products          CRUD   CRUD             leer                  leer
--   vales             CRUD   CRUD             leer, crear (epp/     leer, crear (material,
--                                             herramientas)         trabajador de su área)
--   vale_items        CRUD   CRUD             leer, crear en sus    leer, crear en sus
--                                             vales pendientes      vales pendientes
--   epp_records       CRUD   CRUD             leer, crear           leer
--   tool_assignments  CRUD   CRUD             leer, crear           leer
--   stock_movements   CRUD   leer/crear/borrar  —                   —
--   receptions(+items)CRUD   CRUD             —                     —
--   fuel_records      CRUD   CRUD             —                     —
--   fuel_receptions   CRUD   CRUD             —                     —
--
-- Un perfil con active = false no tiene acceso a nada (salvo leer su propia fila).
-- El cliente service role (src/lib/supabase/admin.ts) sigue bypasseando RLS.
--
-- Idempotente: se puede volver a ejecutar sin errores.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Funciones helper
-- ------------------------------------------------------------
-- SECURITY DEFINER para que puedan leer profiles/workers sin pasar por RLS
-- (evita recursión infinita en las políticas de profiles).

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles
  WHERE id = auth.uid() AND COALESCE(active, true);
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_user_area()
RETURNS text AS $$
  SELECT area FROM public.profiles
  WHERE id = auth.uid() AND COALESCE(active, true);
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- true si el trabajador pertenece al área del usuario actual
CREATE OR REPLACE FUNCTION public.is_worker_in_my_area(p_worker_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workers w
    WHERE w.id = p_worker_id
      AND w.area = public.get_user_area()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Siguiente número de vale calculado sobre TODOS los vales. Necesario porque
-- supervisor solo ve los vales de su área, y calcular max+1 desde el cliente
-- generaría números repetidos (vale_number es UNIQUE).
CREATE OR REPLACE FUNCTION public.next_vale_number()
RETURNS integer AS $$
BEGIN
  IF public.get_user_role() IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  RETURN COALESCE((SELECT MAX(vale_number) FROM public.vales), 2000) + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.next_vale_number() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_vale_number() TO authenticated;

-- ------------------------------------------------------------
-- 2. Proteger columnas privilegiadas de profiles
-- ------------------------------------------------------------
-- La política de UPDATE deja a cada usuario editar su propia fila (perfil →
-- full_name). Sin este trigger, un bodeguero podría hacer
-- update profiles set role = 'admin' where id = auth.uid().
-- Las llamadas con service role (auth.uid() nulo) no se ven afectadas.

CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS trigger AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND public.get_user_role() IS DISTINCT FROM 'admin'
     AND (NEW.id     IS DISTINCT FROM OLD.id
       OR NEW.role   IS DISTINCT FROM OLD.role
       OR NEW.area   IS DISTINCT FROM OLD.area
       OR NEW.active IS DISTINCT FROM OLD.active
       OR NEW.email  IS DISTINCT FROM OLD.email)
  THEN
    RAISE EXCEPTION 'Solo un administrador puede modificar rol, área, estado o email';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS protect_profile_privileged_columns ON public.profiles;
CREATE TRIGGER protect_profile_privileged_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileged_columns();

-- ------------------------------------------------------------
-- 3. Eliminar políticas antiguas
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "Allow all actions for authenticated users" ON profiles;
DROP POLICY IF EXISTS "Allow all actions for authenticated users" ON workers;
DROP POLICY IF EXISTS "Allow all actions for authenticated users" ON categories;
DROP POLICY IF EXISTS "Allow all actions for authenticated users" ON products;
DROP POLICY IF EXISTS "Allow all actions for authenticated users" ON vales;
DROP POLICY IF EXISTS "Allow all actions for authenticated users" ON vale_items;
DROP POLICY IF EXISTS "Allow all actions for authenticated users" ON epp_records;
DROP POLICY IF EXISTS "Allow all actions for authenticated users" ON tool_assignments;
DROP POLICY IF EXISTS "Allow all actions for authenticated users" ON stock_movements;
DROP POLICY IF EXISTS "Allow all actions for authenticated users" ON receptions;
DROP POLICY IF EXISTS "Allow all actions for authenticated users" ON reception_items;
DROP POLICY IF EXISTS "Allow all actions for authenticated users" ON fuel_records;

-- Las políticas son permisivas (se combinan con OR): cualquier otra política
-- "allow all" creada a mano desde el dashboard anularía todo lo de abajo.
-- Se eliminan todas las políticas no-anon de estas tablas; las políticas
-- `TO anon` del flujo de firma se conservan.
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('profiles', 'workers', 'categories', 'products', 'vales',
                        'vale_items', 'epp_records', 'tool_assignments',
                        'stock_movements', 'receptions', 'reception_items',
                        'fuel_records', 'fuel_receptions')
      AND roles <> ARRAY['anon']::name[]
  LOOP
    RAISE NOTICE 'Eliminando política "%" en %', pol.policyname, pol.tablename;
    EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- 4. Nuevas políticas
-- ------------------------------------------------------------
-- (SELECT get_user_role()) va envuelto en SELECT para que Postgres lo evalúe
-- una sola vez por consulta y no por fila.

-- profiles ---------------------------------------------------
-- Todo el personal activo puede leer perfiles: la app muestra el nombre de
-- quien creó/procesó vales, recepciones y movimientos (joins a profiles).
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR (SELECT get_user_role()) IS NOT NULL);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR (SELECT get_user_role()) = 'admin')
  WITH CHECK (id = auth.uid() OR (SELECT get_user_role()) = 'admin');
CREATE POLICY "profiles_insert_admin" ON profiles FOR INSERT TO authenticated
  WITH CHECK ((SELECT get_user_role()) = 'admin');
CREATE POLICY "profiles_delete_admin" ON profiles FOR DELETE TO authenticated
  USING ((SELECT get_user_role()) = 'admin');

-- workers ----------------------------------------------------
CREATE POLICY "workers_select" ON workers FOR SELECT TO authenticated
  USING (
    (SELECT get_user_role()) IN ('admin', 'bodeguero', 'prevencionista')
    OR ((SELECT get_user_role()) = 'supervisor' AND area = (SELECT get_user_area()))
  );
-- prevencionista/supervisor crean trabajadores desde "Nuevo Vale"
CREATE POLICY "workers_insert" ON workers FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT get_user_role()) IN ('admin', 'bodeguero', 'prevencionista')
    OR ((SELECT get_user_role()) = 'supervisor' AND area = (SELECT get_user_area()))
  );
CREATE POLICY "workers_update" ON workers FOR UPDATE TO authenticated
  USING ((SELECT get_user_role()) IN ('admin', 'bodeguero'))
  WITH CHECK ((SELECT get_user_role()) IN ('admin', 'bodeguero'));
CREATE POLICY "workers_delete" ON workers FOR DELETE TO authenticated
  USING ((SELECT get_user_role()) IN ('admin', 'bodeguero'));

-- categories -------------------------------------------------
CREATE POLICY "categories_select" ON categories FOR SELECT TO authenticated
  USING ((SELECT get_user_role()) IS NOT NULL);
CREATE POLICY "categories_write" ON categories FOR ALL TO authenticated
  USING ((SELECT get_user_role()) IN ('admin', 'bodeguero'))
  WITH CHECK ((SELECT get_user_role()) IN ('admin', 'bodeguero'));

-- products ---------------------------------------------------
-- decrease_stock/increase_stock son SECURITY INVOKER: solo funcionan para
-- quien tenga UPDATE aquí (admin y bodeguero).
CREATE POLICY "products_select" ON products FOR SELECT TO authenticated
  USING ((SELECT get_user_role()) IS NOT NULL);
CREATE POLICY "products_write" ON products FOR ALL TO authenticated
  USING ((SELECT get_user_role()) IN ('admin', 'bodeguero'))
  WITH CHECK ((SELECT get_user_role()) IN ('admin', 'bodeguero'));

-- vales ------------------------------------------------------
CREATE POLICY "vales_select" ON vales FOR SELECT TO authenticated
  USING (
    (SELECT get_user_role()) IN ('admin', 'bodeguero', 'prevencionista')
    OR ((SELECT get_user_role()) = 'supervisor'
        AND (created_by = auth.uid() OR is_worker_in_my_area(worker_id)))
  );
CREATE POLICY "vales_insert" ON vales FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT get_user_role()) IN ('admin', 'bodeguero')
    OR ((SELECT get_user_role()) = 'prevencionista'
        AND created_by = auth.uid()
        AND status = 'pendiente'
        AND type IN ('epp', 'cargo_personal', 'uso_diario'))
    OR ((SELECT get_user_role()) = 'supervisor'
        AND created_by = auth.uid()
        AND status = 'pendiente'
        AND type = 'material'
        AND is_worker_in_my_area(worker_id))
  );
-- Despacho (procesar), edición y eliminación: solo bodega
CREATE POLICY "vales_update" ON vales FOR UPDATE TO authenticated
  USING ((SELECT get_user_role()) IN ('admin', 'bodeguero'))
  WITH CHECK ((SELECT get_user_role()) IN ('admin', 'bodeguero'));
CREATE POLICY "vales_delete" ON vales FOR DELETE TO authenticated
  USING ((SELECT get_user_role()) IN ('admin', 'bodeguero'));

-- vale_items -------------------------------------------------
-- Visible si el vale padre es visible (se aplica la RLS de vales).
CREATE POLICY "vale_items_select" ON vale_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM vales v WHERE v.id = vale_items.vale_id));
CREATE POLICY "vale_items_insert" ON vale_items FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT get_user_role()) IN ('admin', 'bodeguero')
    OR ((SELECT get_user_role()) IN ('prevencionista', 'supervisor')
        AND EXISTS (
          SELECT 1 FROM vales v
          WHERE v.id = vale_items.vale_id
            AND v.created_by = auth.uid()
            AND v.status = 'pendiente'
        ))
  );
CREATE POLICY "vale_items_update" ON vale_items FOR UPDATE TO authenticated
  USING ((SELECT get_user_role()) IN ('admin', 'bodeguero'))
  WITH CHECK ((SELECT get_user_role()) IN ('admin', 'bodeguero'));
CREATE POLICY "vale_items_delete" ON vale_items FOR DELETE TO authenticated
  USING ((SELECT get_user_role()) IN ('admin', 'bodeguero'));

-- epp_records ------------------------------------------------
CREATE POLICY "epp_records_select" ON epp_records FOR SELECT TO authenticated
  USING (
    (SELECT get_user_role()) IN ('admin', 'bodeguero', 'prevencionista')
    OR ((SELECT get_user_role()) = 'supervisor' AND is_worker_in_my_area(worker_id))
  );
CREATE POLICY "epp_records_insert" ON epp_records FOR INSERT TO authenticated
  WITH CHECK ((SELECT get_user_role()) IN ('admin', 'bodeguero', 'prevencionista'));
CREATE POLICY "epp_records_update" ON epp_records FOR UPDATE TO authenticated
  USING ((SELECT get_user_role()) IN ('admin', 'bodeguero'))
  WITH CHECK ((SELECT get_user_role()) IN ('admin', 'bodeguero'));
CREATE POLICY "epp_records_delete" ON epp_records FOR DELETE TO authenticated
  USING ((SELECT get_user_role()) IN ('admin', 'bodeguero'));

-- tool_assignments -------------------------------------------
CREATE POLICY "tool_assignments_select" ON tool_assignments FOR SELECT TO authenticated
  USING (
    (SELECT get_user_role()) IN ('admin', 'bodeguero', 'prevencionista')
    OR ((SELECT get_user_role()) = 'supervisor' AND is_worker_in_my_area(worker_id))
  );
CREATE POLICY "tool_assignments_insert" ON tool_assignments FOR INSERT TO authenticated
  WITH CHECK ((SELECT get_user_role()) IN ('admin', 'bodeguero', 'prevencionista'));
-- Préstamos/devoluciones
CREATE POLICY "tool_assignments_update" ON tool_assignments FOR UPDATE TO authenticated
  USING ((SELECT get_user_role()) IN ('admin', 'bodeguero'))
  WITH CHECK ((SELECT get_user_role()) IN ('admin', 'bodeguero'));
CREATE POLICY "tool_assignments_delete" ON tool_assignments FOR DELETE TO authenticated
  USING ((SELECT get_user_role()) IN ('admin', 'bodeguero'));

-- stock_movements (log de auditoría) --------------------------
-- Bodeguero no puede editar movimientos; sí borrarlos porque al eliminar un
-- vale procesado la app revierte su historial.
CREATE POLICY "stock_movements_select" ON stock_movements FOR SELECT TO authenticated
  USING ((SELECT get_user_role()) IN ('admin', 'bodeguero'));
CREATE POLICY "stock_movements_insert" ON stock_movements FOR INSERT TO authenticated
  WITH CHECK ((SELECT get_user_role()) IN ('admin', 'bodeguero'));
CREATE POLICY "stock_movements_update" ON stock_movements FOR UPDATE TO authenticated
  USING ((SELECT get_user_role()) = 'admin')
  WITH CHECK ((SELECT get_user_role()) = 'admin');
CREATE POLICY "stock_movements_delete" ON stock_movements FOR DELETE TO authenticated
  USING ((SELECT get_user_role()) IN ('admin', 'bodeguero'));

-- receptions / reception_items --------------------------------
CREATE POLICY "receptions_bodega" ON receptions FOR ALL TO authenticated
  USING ((SELECT get_user_role()) IN ('admin', 'bodeguero'))
  WITH CHECK ((SELECT get_user_role()) IN ('admin', 'bodeguero'));
CREATE POLICY "reception_items_bodega" ON reception_items FOR ALL TO authenticated
  USING ((SELECT get_user_role()) IN ('admin', 'bodeguero'))
  WITH CHECK ((SELECT get_user_role()) IN ('admin', 'bodeguero'));

-- fuel_records / fuel_receptions (Petróleo) -------------------
-- fuel_receptions no está en ningún .sql del repo (se creó desde el
-- dashboard), por eso se configura solo si existe.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['fuel_records', 'fuel_receptions'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
           USING ((SELECT public.get_user_role()) IN (''admin'', ''bodeguero''))
           WITH CHECK ((SELECT public.get_user_role()) IN (''admin'', ''bodeguero''))',
        t || '_bodega', t);
    END IF;
  END LOOP;
END $$;

COMMIT;

