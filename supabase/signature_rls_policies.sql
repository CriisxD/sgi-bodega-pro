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
