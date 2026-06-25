require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const eppItems = [
  { name: 'Casco Blanco', stock: 5 },
  { name: 'Casco Amarillo', stock: 0 },
  { name: 'Casco Azul', stock: 6 },
  { name: 'Casco Gris', stock: 1 },
  { name: 'Legionario', stock: 15 },
  { name: 'Barbiquejo', stock: 70 },
  { name: 'Protector Auditivo', stock: 150 },
  { name: 'Protector Auditivo al Casco', stock: 0 },
  { name: 'Lente de Seguridad In Out', stock: 0 },
  { name: 'Lente de Seguridad Claro', stock: 7 },
  { name: 'Lente de Seguridad Oscuro', stock: 22 },
  { name: 'Soporte de Visor', stock: 7 },
  { name: 'Visor Policarbonato', stock: 0 },
  { name: 'Mascarilla Desechable 3M', stock: 93 },
  { name: 'Filtro Air', stock: 1 },
  { name: 'Cubre Lentes Claro', stock: 4 },
  { name: 'Guante Cabretilla', stock: 400, unit: 'par' },
  { name: 'Guante Soldador', stock: 17, unit: 'par' },
  { name: 'Guante Multiflex', stock: 7, unit: 'par' },
  { name: 'Guante Anti Vibracion', stock: 2, unit: 'par' },
  { name: 'Overol M', stock: 0 },
  { name: 'Overol L', stock: 0 },
  { name: 'Overol XL', stock: 0 },
  { name: 'Overol XXL', stock: 0 },
  { name: 'Overol XXXL', stock: 0 },
  { name: 'Chaqueta Cuero M', stock: 2 },
  { "name": "Chaqueta Cuero Atox L", "stock": 0 },
  { "name": "Chaqueta Cuero Atox XL", "stock": 0 },
  { "name": "Chaqueta Cuero Atox XXL", "stock": 0 },
  { "name": "Pantalon Cuero Atox M", "stock": 1 },
  { "name": "Pantalon Cuero Atox L", "stock": 0 },
  { "name": "Pantalon Cuero Atox XL", "stock": 0 },
  { "name": "Pantalon Cuero Atox XXL", "stock": 0 },
  { "name": "Coleto Descarne de Cuero", "stock": 9 },
  { "name": "Polaina de Cuero", "stock": 5 },
  { "name": "Buzo Blanco Merida", "stock": 13 },
  { "name": "Capa de Agua", "stock": 0 },
  { "name": "Geologo Minero L", "stock": 0 },
  { "name": "Geologo Minero XL", "stock": 0 },
  { "name": "Geologo Minero XXL", "stock": 0 },
  { "name": "Geologo Canvas L", "stock": 0 },
  { "name": "Geologo Canvas XL", "stock": 0 },
  { "name": "Geologo Canvas XXL", "stock": 0 },
  { "name": "Rodillera Poliester", "stock": 0 },
  { "name": "Bota de Goma 40", "stock": 2, "unit": "par" }
];

async function importEpp() {
  console.log('Fetching EPP category...');
  let { data: catData, error: catError } = await supabase
    .from('categories')
    .select('id')
    .eq('type', 'epp')
    .limit(1)
    .single();

  let eppCatId = catData?.id;

  if (!eppCatId || catError) {
    console.log('EPP category not found, creating one...');
    const { data: newCat } = await supabase
      .from('categories')
      .insert({ name: 'Equipos de Protección Personal', type: 'epp', description: 'EPP' })
      .select()
      .single();
    eppCatId = newCat.id;
  }

  console.log('Fetching existing products...');
  const { data: existingProducts } = await supabase
    .from('products')
    .select('id, name');

  let insertedCount = 0;
  let updatedCount = 0;

  for (const item of eppItems) {
    const existing = existingProducts.find(p => p.name.toLowerCase() === item.name.toLowerCase());
    
    if (existing) {
      await supabase
        .from('products')
        .update({ stock: item.stock, category_id: eppCatId, unit: item.unit || 'un', active: true })
        .eq('id', existing.id);
      updatedCount++;
    } else {
      await supabase
        .from('products')
        .insert({
          name: item.name,
          category_id: eppCatId,
          stock: item.stock,
          min_stock: item.unit === 'par' ? 2 : 5,
          unit: item.unit || 'un',
          active: true
        });
      insertedCount++;
    }
  }

  console.log(`Import complete. Inserted: ${insertedCount}, Updated: ${updatedCount}`);
}

importEpp().catch(console.error);
