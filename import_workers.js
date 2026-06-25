require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const rawWorkers = [
  ['Acuña', 'Ramirez', 'Jazón Andrés', 'REPASO'],
  ['Aguilera', 'Bascuñant', 'Diego Antonio', 'PRETENSADO B3'],
  ['', 'Aguilera', 'YOHANY', 'MAESTRO'],
  ['Alarcón', 'Vidal', 'Helia Gabriela', 'ASEO'],
  ['Almendras', 'Godoy', 'Miguel', 'Operador Producción'],
  ['ALVAREZ', '', 'JUAN', 'Ayudante Producción'],
  ['Anabalon', 'Lara', 'Abel', 'Supervisor'],
  ['Avello', 'Troncoso', 'Hugo froilan', 'PUENTE GRUA'],
  ['ARANEDA', 'Uribe', 'BRAYAN', 'COSTANERAS'],
  ['Ávila', 'Aro', 'Álvaro Francés', 'SOLDADOR PRODUCCIÓN'],
  ['Balboa', 'Quezada', 'Roberto carlos', 'PRELOSAS'],
  ['BASCUR', '-', 'RIGOBERTO', 'MAESTRO'],
  ['Bascuñan', 'Quezada', 'Jorge Andrés', 'YALE/CARGADOR'],
  ['Becerra', 'Ríos', 'Juan Ariel', 'PRETENSADO B1'],
  ['Burgos', 'Plaza', 'Pedro Pablo', 'BANCO 3'],
  ['Betancur', 'Jeldres', 'Darwin', 'Maestro Producción'],
  ['BRIONES', '', 'YAMILET', ''],
  ['CABEZAS', '', 'MATIAS', 'CALIDAD'],
  ['Cabezas', 'Cerda', 'Jonahan Josué', 'MANTENCIÓN MECÁNICA'],
  ['Carrasco', 'GONZALEZ', 'MARCO EFRAIN', 'PRETENSADO B1'],
  ['Carrasco', 'Quezada', 'MARIO ALEJANDRO', 'PRETENSADO B3'],
  ['Castro', 'SAAVEDRA', 'Billy Robinson', ''],
  ['Castro', 'VASQUEZ', 'PEDRO', 'MAESTRO'],
  ['CRUZ', 'HUINCAHUAL', 'NICOLAS ELUNEY', 'ASISTENTE COMPRAS'],

  // Image 2
  ['FLORES', 'CARRASCO', 'BENJAMIN IGNACIO', 'CALIDAD DURMIENTES'],
  ['FIGUEROA', 'DIAZ', 'BENJAMIN ALEEN', 'CALIDAD DURMIENTES'],
  ['Castillo', 'Rivas', 'Jaime Alberto', 'MAESTRO OBRAS CIVILES'],
  ['Guajardo', 'Almendras', 'Manuel Alejandro', 'DURMIENTES'],
  ['Jara', 'Maureira', 'Sisto Jonny', 'CAPATAZ DE OBRA'],
  ['Lepe', 'Pacheco', 'Henry Humberto', 'YUDANTE DE OBRAS CIVILE'],
  ['Mendoza', 'Lemun', 'Juan Bautista', 'MAESTRO OBRAS CIVILES'],
  ['Quiroz', 'Gajardo', 'Cristopher Andrés', 'YUDANTE DE OBRAS CIVILE'],
  ['Vallejos', 'Peña', 'Luis Reinaldo', 'MAESTRO OBRAS CIVILES'],
  ['Vallejos', 'Peña', 'Vladimir Alex', 'MAESTRO OBRAS CIVILES'],
  ['Castillo', 'Muñoz', 'Eric Cristofer', 'DURMIENTES'],
  ['Arriagada', 'Valdebenito', 'brian alexis', 'DURMIENTES'],
  ['lepe', 'mera', 'ricardo antonio', ''],
  ['carrasco', 'ibañez', 'carlos eduardo', ''],
  ['gonzalez', 'briones', 'ricardo emilio', ''],
  ['tenorio', 'garces', 'miguel angel', ''],
  ['matus', 'boyser', 'maykol jose', ''],
  ['salazar', 'riquelme', 'hector gerardo', ''],
  ['castillo', 'chavez', 'cristopher maximiliano', ''],
  ['perez', 'contreras', 'jose hernan', ''],
  ['san martin', 'cardenas', 'marco antonio', 'ayudante'],
  ['CASTILLO', 'ALVAREZ', 'CHRISTOPHER', 'OPERADOR'],
  ['LARA', '', 'PATRICIO', 'MAESTRO - DURMIENTES'],
  ['FLORES', '', 'CESAR', 'MAESTRO - DURMIENTES'],
  ['ACUÑA', 'JARA', 'PEDRO', 'DURMIENTES'],
  ['ACUÑA', 'Valdebenito', 'PEDRO', 'DURMIENTES'],
  ['CABEZAS', '', 'MATIAS', 'CONTROL CALIDAD'], // might be dup of above MATIAS CABEZAS

  // Image 3
  ['Otarola', 'Medina', 'Elías Hipolito', 'PRETENSADO B1'],
  ['Otarola', 'Gutiérrez', 'Julio Cesar', 'PRETENSADO B1'],
  ['Otarola', 'Medina', 'Juan Carlos', 'PRETENSADO B1'],
  ['Parra', 'Herrera', 'Juan Hermo', 'PRELOSAS'],
  ['Parra', 'Aravena', 'Jeremy Felipe', 'PUENTE GRUA'],
  ['Quijada', 'Muñoz', 'Guillermo Camilo', 'PRETENSADO B2'],
  ['Quilodran', 'Navarrete', 'Pablo Andrés', 'PRETENSADO B3'],
  ['QUEZADA', 'SANHUEZA', 'HUGO', 'LABORATORIO'],
  ['Retamal', 'Contreras', 'Luis Humberto', 'COSTANERAS'],
  ['Riquelme', 'Riquelme', 'Víctor Ricardo', 'MANTENCIÓN ELECTRICA'],
  ['Rivera', 'Soto', 'Mario Sebastián', 'REPASO'],
  ['ROJAS', 'Soto', 'SERGIO ESTEBAN', 'OBRAS CIVILES'],
  ['Salgado', 'Campos', 'Miguel Alfredo', 'PRETENSADO B3'],
  ['Sánchez', 'Cuevas', 'Juan Manuel', 'REPASO'],
  ['SALAZAR', '', 'SAMUEL', 'AYUDANTE'],
  ['Sandoval', 'Sandoval', 'Samuel Alejandro', 'YALE/CARGADOR'],
  ['Sepulveda', 'Rodriguez', 'Victor Hugo', 'COSTANERAS'],
  ['SANHUEZA', 'PALACIOS', 'Cristian', 'CALIDAD'],
  ['SOTO', '', 'PATRICIO', 'MAESTRO'],
  ['Troncoso', 'Urrutia', 'Mariano Alexis', 'PRETENSADO B2'],
  ['Uribe', 'Rodriguez', 'Alejandro Sigisfredo', 'AYUDANTE PPRR'],
  ['Urbina', '', 'Juan', 'PREVENCIONISTA'],
  ['VALDEBENITO', 'PINO', 'JIMMY', 'MAESTRO'],
  ['Valenzuela', 'San Martín', 'Sebastián de Jesús', 'ACOPIO POSTES'],
  ['Vallejos', 'Muñoz', 'Erwin Sebastián', 'COSTANERAS'],
  ['Verdugo', 'Rivera', 'Juan Alejandro', 'PUENTE GRUA'],
  ['Verdugo', 'Salvo', 'Matías Leonardo', 'COSTANERAS'],
  ['Verdugo', 'Melgarejo', 'Víctor', 'Producción'],

  // Image 4
  ['SALGADO', 'GONZALEZ', 'DIEGO ANTONIO', 'ENCARGADO BODEGA'],
  ['SANDOVAL', '', 'MAURICIO', 'SUPERVISOR DURMIENTES'],
  ['ASTORGA', '', 'JUAN PABLO', 'OP. GRUA HORQUILLA'],
  ['MELO', '', 'CARLOS', 'DURMIENTES'],
  ['SOTO', '', 'MARIO', 'AYUDANTE PRODUCCION'],
  ['SALAZAR', '', 'SAMUEL', 'AYUDANTE'], // duplicate
  ['AGUILERA', 'INZUNZA', 'YOHANY', 'AYUDANTE'],
  ['AVALOS', 'MORALES', 'WILLIAMS ALEJANDRO', ''],
  ['ESPINOZA', 'BERRIOS', 'JORGE', 'MAESTRO'],
  ['QUIJADA', '', 'GUILLERMO', ''],
  ['SALAZAR', '', 'CHRISTOPHER', ''],
  ['CARO', 'HERRERA', 'Jaime Alberto', 'SOLDADOR'],
  ['CORRALLE', '', 'FRANCO', 'DURMIENTES'],
  ['GRANDON', '', 'ALEXIS', 'AYUDANTE LABORATORIO'],
  ['ALMENDRAS', '', '', ''],
  ['HUICHALAF', '', 'ENOC', 'AYUDANTE'],
  ['URBINA', '', 'JUAN', 'PREVENCION'],
  ['HIGUERAS', 'ILLESCA', 'RENE', 'MAESTRO-DURMIENTES'],
  ['CONSTANZO', '', 'CECILIA', 'JEFE DE LOGISTICA'],
  ['MORENO', '', 'ROCIO', 'CONTABILIDAD'],
  ['ABARZUA', 'FUENTES', 'FRANCISCO', 'MAESTRO-DURMIENTES'],
  ['GUAJARDO', '', 'FABIAN', 'DURMIENTES'],
  ['SANHUEZA', '', 'ALEJANDRO', ''],
  ['', 'DIAZ', 'CAROLINA', 'ADMINISTRATIVA'],
  ['VENEGAS', 'MELLADO', 'FRANCISCO', 'SOLDADOR-DURMIENTES'],
  ['SALAZAR', '', 'GONZALO', ''],

  // Image 5
  ['Verdugo', 'Pinilla', 'Bryan', 'ASISTENTE COMPRAS'],
  ['Yáñez', 'Sepulveda', 'Mauricio Alexis', 'CALDERA'],
  ['YAÑEZ', 'AGUILAR', 'ALAN', 'Ayudante Producción'],
  ['Zapata', 'Cifuentes', 'Richard Antonio', 'PILARES'],
  ['ARTIAGAS', 'ARRATIA', 'FRANCISCO JAVIER', ''],
  ['CANDIA', 'REYES', 'HRISTOPHER EDMUNDO', ''],
  ['GONZALEZ', 'HERRERA', 'CARLOS IGNACIO', ''],
  ['GUAJARDO', 'SANHUEZA', 'BENJAMIN ANDRES', ''],
  ['MONTOYA', 'RODRIGUEZ', 'CARLOS VICTOR', ''],
  ['PACHECO', 'ACEVEDO', 'LUIS ANGEL', ''],
  ['OBREQUE', 'LOBOS', 'JOSE MANUEL', ''],
  ['Venegas', 'Salas', 'José Miguel', 'PINTOR'],
  ['Erices', 'Novoa', 'Carlos Alexis', 'SOLDADOR/ VIVEROS'],
  ['Olea', 'Urrutia', 'DANIEL', 'SOLDADOR'],
  ['INOSTROZA', '', 'JUAN PABLO', 'SOLDADOR/ VIVEROS'],
  ['Gonzalez', 'Saez', 'Andrés Ariel', 'SOLDADOR/ VIVEROS'],
  ['Hidd', 'Carrasco', 'Cristopher Alexander', 'SOLDADOR/ VIVEROS'],
  ['San Martin', 'Viveros', 'Alexander Javier', 'SOLDADOR/ VIVEROS'],
  ['Seguel', 'Segura', 'Adrian Ignacio', 'SOLDADOR/ VIVEROS'],
  ['Tenorio', 'Lorca', 'Angel Santiago', 'SOLDADOR/ VIVEROS'],
  ['Ulloa', 'Escobar', 'Eladio Gabino', 'SOLDADOR/ VIVEROS'],
  ['Viveros', 'Ovando', 'Cristián Alejandro', 'SOLDADOR/ VIVEROS'],
  ['Viveros', 'Acuña', 'Luis Félix', 'SOLDADOR/ VIVEROS'],
  ['Viveros', 'Valdebenito', 'Mirna Eny Monserrat', 'SOLDADOR/ VIVEROS'],
  ['Vallejos', 'valeria', 'Fabian Alejandro', 'AYUDANTE/VIVEROS'],
  ['Mellado', 'Sanchez', 'Hector Daniel', 'Soldador'],
  ['Vallejos', 'Muñoz', 'victor horacio', 'Jefe producción DURMIENTES'],
  ['CERDA', 'LOPEZ', 'JOSE JOAQUIN', 'OF. TECNICA DURMIENTES']
];

function normalizeString(str) {
  if (!str) return '';
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function parseRoleAndArea(ubicacion) {
  ubicacion = ubicacion.trim();
  if (!ubicacion) return { area: 'General', position: 'Trabajador' };
  
  const uLower = ubicacion.toLowerCase();
  let position = 'Trabajador';
  let area = 'General';

  if (uLower.includes('soldador')) position = 'Soldador';
  else if (uLower.includes('ayudante')) position = 'Ayudante';
  else if (uLower.includes('maestro')) position = 'Maestro';
  else if (uLower.includes('supervisor')) position = 'Supervisor';
  else if (uLower.includes('capataz')) position = 'Capataz';
  else if (uLower.includes('jefe')) position = 'Jefe';
  else if (uLower.includes('encargado')) position = 'Encargado';
  else if (uLower.includes('asistente')) position = 'Asistente';
  else if (uLower.includes('operador')) position = 'Operador';
  else if (uLower.includes('pintor')) position = 'Pintor';
  else if (uLower.includes('prevencion')) position = 'Prevencionista';

  // Area mapping
  if (uLower.includes('durmiente')) area = 'Durmientes';
  else if (uLower.includes('produccion') || uLower.includes('producción')) area = 'Producción';
  else if (uLower.includes('pretensado')) {
    if (uLower.includes('b1')) area = 'Pretensado B1';
    else if (uLower.includes('b2')) area = 'Pretensado B2';
    else if (uLower.includes('b3')) area = 'Pretensado B3';
    else area = 'Pretensado';
  }
  else if (uLower.includes('prelosas')) area = 'Prelosas';
  else if (uLower.includes('calidad')) area = 'Calidad';
  else if (uLower.includes('manten')) area = 'Mantenimiento';
  else if (uLower.includes('vivero')) area = 'Viveros';
  else if (uLower.includes('costanera')) area = 'Costaneras';
  else if (uLower.includes('obra')) area = 'Obras Civiles';
  else if (uLower.includes('repaso')) area = 'Repaso';
  else if (uLower.includes('grua') || uLower.includes('grúa')) area = 'Puente Grúa';
  else if (uLower.includes('logistica')) area = 'Logística';
  else if (uLower.includes('bodega')) area = 'Bodega';
  else if (uLower.includes('laboratorio')) area = 'Laboratorio';
  else if (uLower.includes('compras')) area = 'Compras';
  else area = ubicacion; // fallback to raw string

  return { area, position };
}

async function run() {
  console.log('Fetching existing workers...');
  const { data: existingWorkers } = await supabase.from('workers').select('id, name, active');
  
  let inserted = 0;
  let updated = 0;

  for (const raw of rawWorkers) {
    const apPat = raw[0].trim();
    const apMat = raw[1].trim();
    const noms = raw[2].trim();
    const ub = raw[3].trim();

    if (!apPat && !noms) continue; // empty row

    // construct full name
    const parts = [];
    if (noms) parts.push(noms);
    if (apPat) parts.push(apPat);
    if (apMat && apMat !== '-') parts.push(apMat);
    const fullName = parts.join(' ').replace(/\s+/g, ' ');

    const { area, position } = parseRoleAndArea(ub);

    const normNewName = normalizeString(fullName);
    const newNameWords = normNewName.split(' ');

    // Try to find a match
    let match = null;
    for (const w of existingWorkers) {
      const normExist = normalizeString(w.name);
      const existWords = normExist.split(' ');
      
      // If at least two words match exactly, or one word matches if total is short
      const commonWords = existWords.filter(word => newNameWords.includes(word));
      if (commonWords.length >= 2 || (commonWords.length === 1 && (existWords.length === 1 || newNameWords.length === 1))) {
        match = w;
        break;
      }
    }

    if (match) {
      // Update
      const { error } = await supabase
        .from('workers')
        .update({ 
          area, 
          position,
          active: true // reactivate if inactive
        })
        .eq('id', match.id);
      
      if (error) console.error('Error updating', fullName, error);
      else updated++;
    } else {
      // Insert
      const generatedRut = 'S/N-' + Math.floor(Math.random() * 1000000);
      const { error } = await supabase
        .from('workers')
        .insert({
          name: fullName.toUpperCase(), // keep uppercase to match style? No, Title Case
          rut: generatedRut,
          area,
          position,
          is_external: false,
          active: true
        });
      
      if (error) console.error('Error inserting', fullName, error);
      else inserted++;
    }
  }

  console.log(`Worker import complete! Inserted: ${inserted}, Updated (merged): ${updated}`);
}

run().catch(console.error);
