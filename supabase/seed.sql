-- ============================================================
-- SGI Bodega Pro — Initial Demo Seed Data
-- ============================================================

-- NOTE: Since users are managed by Supabase Auth, you manually have to create them
-- in the Supabase Dashboard, and they will auto-sync to public.profiles via the trigger.
-- Update 'YOUR_ADMIN_ID', etc. below to those generated auth.users UUIDs before running.
-- IF testing locally with supabase stop/start, you can seed auth.users. 
-- For a raw cloud database, do this:
-- 1. Create users via Auth UI with metadata: {"full_name": "Admin", "role": "admin"}
-- 2. Grab their UUIDs and update the vales later.
-- We will just seed categories, workers, products here assuming user is doing tests.

-- Default UUIDs for mock data
DO $$
DECLARE
  cat_epp UUID := uuid_generate_v4();
  cat_herra UUID := uuid_generate_v4();
  cat_mat UUID := uuid_generate_v4();
  work1 UUID := uuid_generate_v4();
  work2 UUID := uuid_generate_v4();
  work3 UUID := uuid_generate_v4();
  prod1 UUID := uuid_generate_v4();
  prod2 UUID := uuid_generate_v4();
  prod3 UUID := uuid_generate_v4();
  prod4 UUID := uuid_generate_v4();
BEGIN

-- 1. Categories
INSERT INTO public.categories (id, name, type) VALUES
(cat_epp, 'EPP Básico', 'epp'),
(cat_herra, 'Herramientas Eléctricas', 'herramienta'),
(cat_mat, 'Insumos Metálicos', 'material');

-- 2. Workers (Filtered by area: 'Mantenimiento', 'Producción', 'Logística')
INSERT INTO public.workers (id, rut, name, position, area) VALUES
(work1, '11.111.111-1', 'Juan Pérez', 'Operador', 'Mantenimiento'),
(work2, '22.222.222-2', 'María González', 'Técnico', 'Mantenimiento'),
(work3, '33.333.333-3', 'Pedro Soto', 'Conductor', 'Logística'),
(uuid_generate_v4(), '44.444.444-4', 'Ana Silva', 'Empaquetador', 'Producción'),
(uuid_generate_v4(), '55.555.555-5', 'Luis Morales', 'Supervisor Terreno', 'Mantenimiento');

-- 3. Products
INSERT INTO public.products (id, name, category_id, stock, min_stock, unit, zone) VALUES
(prod1, 'Casco de Seguridad Blanco', cat_epp, 50, 10, 'un', 'cabeza'),
(prod2, 'Guantes de Cuero', cat_epp, 120, 20, 'par', 'manos'),
(prod3, 'Taladro Inalámbrico 20V', cat_herra, 5, 2, 'un', null),
(prod4, 'Tornillos Autoperforantes 1"', cat_mat, 5000, 1000, 'un', null);

-- 4. Sample Vales & Tool Assignments (we will skip vale inserts here unless we have actual profile UUIDs,
-- but let's insert one without user IDs if foreign keys allow NULL - wait, created_by is NOT NULL technically,
-- actually created_by is NULLable via 'ON DELETE RESTRICT' ? No, better not to insert vales without users.
-- We will just seed workers, categories, and products.
-- You can create Vales directly through the new Next.js UI!)

END $$;
