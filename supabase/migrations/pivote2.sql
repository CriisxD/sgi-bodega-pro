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
