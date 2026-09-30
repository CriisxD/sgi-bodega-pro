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
