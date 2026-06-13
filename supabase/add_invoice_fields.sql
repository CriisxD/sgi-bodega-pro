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
