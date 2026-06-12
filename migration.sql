-- Migración para añadir Precio Unitario a las recepciones de bodega
ALTER TABLE reception_items ADD COLUMN IF NOT EXISTS unit_price NUMERIC;
