require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Starting cleanup...');
  
  // Find workers to delete
  const { data: workers, error } = await supabase.from('workers')
    .select('id, name, rut')
    .in('rut', ['11.111.111-1', '22.222.222-2', '33.333.333-3', '44.444.444-4', '55.555.555-5', '99.999.999-9']);
    
  if (error) throw error;
  
  if (!workers || workers.length === 0) {
    console.log('No test workers found.');
    return;
  }
  
  console.log('Found test workers to delete:', workers.map(w => w.name).join(', '));
  
  const workerIds = workers.map(w => w.id);
  
  // Need to delete related vales first to avoid FK constraint error
  const { data: vales } = await supabase.from('vales').select('id').in('worker_id', workerIds);
  if (vales && vales.length > 0) {
    const valeIds = vales.map(v => v.id);
    await supabase.from('vale_items').delete().in('vale_id', valeIds);
    await supabase.from('epp_records').delete().in('vale_id', valeIds);
    await supabase.from('tool_assignments').delete().in('vale_id', valeIds);
    await supabase.from('vales').delete().in('id', valeIds);
    console.log(`Deleted ${valeIds.length} related vales.`);
  }
  
  // Delete epp_records and tool_assignments directly linked to worker_id just in case
  await supabase.from('epp_records').delete().in('worker_id', workerIds);
  await supabase.from('tool_assignments').delete().in('worker_id', workerIds);
  
  // Delete workers
  const { error: delError } = await supabase.from('workers').delete().in('id', workerIds);
  if (delError) throw delError;
  
  console.log('Successfully deleted test workers.');
}

run().catch(console.error);
