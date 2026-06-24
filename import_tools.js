require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const data = [
  { herramienta: "Cango Makita", trabajador: "Billy Castro", area: "Operador Planta", disp: "Si" },
  { herramienta: "Soplador Bosch", trabajador: "Jaime Castillo", area: "Durmientes", disp: "Si" },
  { herramienta: "Galletero 4\"", trabajador: "Rewe Moya", area: "Soldador", disp: "Si" },
  { herramienta: "Galletero Makita(2000)", trabajador: "Carlos Carrasco", area: "Durmientes", disp: "Si" },
  { herramienta: "Hidro + Extencion", trabajador: "Jaime Maturana", area: "Produccion", disp: "Si" },
  { herramienta: "Galletero 4\" + Extencion", trabajador: "Mario Rivera", area: "Repaso", disp: "Si" },
  { herramienta: "Galletero 7\"", trabajador: "Juan Sanchez", area: "Repaso", disp: "Si" },
  { herramienta: "Galletero 4\" + Extencion", trabajador: "Juan Sanchez", area: "Repaso", disp: "Si" },
  { herramienta: "Soplador + Rotomartillo", trabajador: "Juan Sanchez", area: "Repaso", disp: "Si" },
  { herramienta: "Galletero 9\"", trabajador: "Marco San Martin", area: "Produccion", disp: "Si" },
  { herramienta: "Galletero Metabo 9\"", trabajador: "Eric Castillo", area: "Durmientes", disp: "Si" },
  { herramienta: "Galletero Metabo 9\"", trabajador: "Jose Perez", area: "Durmientes", disp: "Si" },
  { herramienta: "Taladro inalambrico", trabajador: "Segundo Morales", area: "Durmientes", disp: "Si" },
  
  { herramienta: "Taladro inalambrico 28m", trabajador: "Bodega", area: "Produccion", disp: "Si" },
  { herramienta: "Caladora Makita", trabajador: "Bodega", area: "Produccion", disp: "Si" },
  { herramienta: "Taladro inalambrico(metabo)", trabajador: "Bodega", area: "Produccion", disp: "Si" },
  { herramienta: "Taladro inalambrico(Makita)", trabajador: "Bodega", area: "Produccion", disp: "Si" },
  { herramienta: "Taladro inalambrico (Milwauke)", trabajador: "Bodega", area: "Produccion", disp: "Si" },
  { herramienta: "Sierra Circular (Einhell)", trabajador: "Bodega", area: "Produccion", disp: "Si" },
  { herramienta: "Soplador", trabajador: "Bodega", area: "Produccion", disp: "Si" },
  { herramienta: "Demoledor Makita", trabajador: "Bodega", area: "Produccion", disp: "Si" },
  { herramienta: "Taladro Makita (Nuevo)", trabajador: "Bodega", area: "Produccion", disp: "Si" },
  { herramienta: "Sierra Circular (Bosch)", trabajador: "Bodega", area: "Produccion", disp: "Si" },
  { herramienta: "Taladro Plus(Kothman)", trabajador: "Bodega", area: "Produccion", disp: "Si" },
  
  { herramienta: "Galletero 9\" Makita", trabajador: "Carlos Briceño", area: "Produccion", disp: "Si", notes: "19/06/26" },
  { herramienta: "Galletero 7\" Kothman", trabajador: "Rene Moya", area: "Produccion", disp: "Si", notes: "22/06/26" },
  { herramienta: "Galletero 7\" Kothman", trabajador: "Yimyy Valderrama", area: "Produccion", disp: "Si", notes: "19/06/26" },
  { herramienta: "Galletero 4 1/2 Makita", trabajador: "Marco Carrasco", area: "Produccion", disp: "Si", notes: "19/06/26" },
  { herramienta: "Galletero 4 1/2 Makita", trabajador: "Carlos Llanos", area: "Produccion", disp: "Si", notes: "19/06/26" },
  { herramienta: "Galletero 4 1/2 Makita", trabajador: "Bodega", area: "Produccion", disp: "Si" },

  { herramienta: "Cango Chico (Malo)", trabajador: "Bodega", area: "Produccion", disp: "No" },
  { herramienta: "Cango Mediano (Malo)", trabajador: "Bodega", area: "Produccion", disp: "No" },
  { herramienta: "Cango Chico (Malo)", trabajador: "Bodega", area: "Produccion", disp: "No" },
  { herramienta: "Sierra Circular Makita (Mala)", trabajador: "Bodega", area: "Produccion", disp: "No" },
  { herramienta: "Soplador Stihl (Malo)", trabajador: "Bodega", area: "Produccion", disp: "No" },
  { herramienta: "Taladro Makita (Malo)", trabajador: "Bodega", area: "Produccion", disp: "No" },
  { herramienta: "Cango Einhell (Nuevo)", trabajador: "Bodega", area: "Produccion", disp: "No" }
];

async function run() {
  console.log('Starting import...');

  // 1. Ensure category "Herramientas"
  let { data: cat } = await supabase.from('categories').select('*').eq('name', 'Herramientas').single();
  if (!cat) {
    const { data: newCat, error: catErr } = await supabase.from('categories').insert({ name: 'Herramientas', type: 'herramienta' }).select().single();
    if (catErr) throw catErr;
    cat = newCat;
    console.log('Created category Herramientas');
  } else {
    console.log('Found category Herramientas');
  }

  // 2. Fetch or create workers
  const { data: existingWorkers } = await supabase.from('workers').select('*');
  const workerMap = new Map(existingWorkers.map(w => [w.name.toLowerCase(), w]));

  const adminQuery = await supabase.from('profiles').select('*').eq('role', 'admin').limit(1);
  const adminId = adminQuery.data?.[0]?.id;

  for (const row of data) {
    // Determine active
    const isActive = row.disp === 'Si';

    // Check if worker
    let workerId = null;
    if (row.trabajador.toLowerCase() !== 'bodega') {
      const wName = row.trabajador.toLowerCase();
      if (!workerMap.has(wName)) {
        const { data: newW, error: wErr } = await supabase.from('workers').insert({
          name: row.trabajador,
          rut: `S/N-${Math.floor(Math.random() * 1000000)}`,
          area: row.area,
          position: 'Trabajador',
          active: true
        }).select().single();
        if (wErr) throw wErr;
        workerMap.set(wName, newW);
        console.log(`Created worker: ${row.trabajador}`);
      }
      workerId = workerMap.get(wName).id;
    }

    // Insert Product
    const { data: prod, error: pErr } = await supabase.from('products').insert({
      name: row.herramienta,
      category_id: cat.id,
      stock: 1, // each row is a physical tool instance
      min_stock: 0,
      unit: 'un',
      active: isActive
    }).select().single();

    if (pErr) throw pErr;
    console.log(`Created product: ${row.herramienta}`);

    // If it's assigned to someone, we should ideally create a Vale.
    if (workerId && adminId) {
      // Create a Vale
      const { data: vale, error: vErr } = await supabase.from('vales').insert({
        type: 'cargo_personal',
        status: 'procesado',
        created_by: adminId,
        processed_by: adminId,
        worker_id: workerId,
        notes: row.notes ? `Prestado el ${row.notes} (Importado del registro en papel)` : `Importado del registro en papel`,
        vale_date: new Date().toISOString()
      }).select().single();

      if (vErr) throw vErr;

      // Add Vale Item
      await supabase.from('vale_items').insert({
        vale_id: vale.id,
        product_id: prod.id,
        quantity: 1,
        quantity_delivered: 1
      });

      // Add Tool Assignment
      await supabase.from('tool_assignments').insert({
        worker_id: workerId,
        product_id: prod.id,
        vale_id: vale.id,
        status: 'activo',
        quantity: 1,
        assigned_at: new Date().toISOString()
      });

      // Decrease stock to 0 because it's lent
      await supabase.from('products').update({ stock: 0 }).eq('id', prod.id);

      console.log(`Created assignment for ${row.trabajador}`);
    }
  }

  console.log('Import complete!');
}

run().catch(console.error);
