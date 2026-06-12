require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: categories, error } = await supabase.from('categories').select('*');
  if (error) {
    console.error('Error fetching categories', error);
    return;
  }
  
  console.log('Categories:', categories);

  // Let's find all categories named 'EPP' or 'epp'
  for (const cat of categories) {
    if (cat.name.toLowerCase() === 'epp') {
      if (cat.type !== 'epp') {
        console.log(`Fixing category ${cat.id} (${cat.name}): changing type from ${cat.type} to 'epp'`);
        await supabase.from('categories').update({ type: 'epp' }).eq('id', cat.id);
      }
    }
  }

  console.log('Fix complete.');
}

run();
