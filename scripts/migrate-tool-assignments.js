// Use Supabase Management API to run SQL
async function migrate() {
  const projectRef = 'qynekehrnuzvrwygieir';
  const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5bmVrZWhybnV6dnJ3eWdpZWlyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTA0MDQzOCwiZXhwIjoyMDk2NjE2NDM4fQ.kb6FuNUkko5SrOiQmmIAL8OMlJrTqLnQB8i8Ck5Gvm8';
  
  // First, create the exec_sql function using the service role key 
  // We'll use a direct PostgreSQL connection through supabase's pg_net extension
  // Actually, let's use the Supabase SQL API 
  
  const sql = `
    ALTER TABLE tool_assignments ADD COLUMN IF NOT EXISTS quantity integer DEFAULT 1;
    ALTER TABLE tool_assignments ADD COLUMN IF NOT EXISTS signature text;
  `;
  
  // Try using the Supabase pg endpoint (available for service role)
  const url = `https://${projectRef}.supabase.co/pg`;
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ query: sql })
  });
  
  console.log('PG endpoint status:', res.status);
  const text = await res.text();
  console.log('PG endpoint response:', text);
  
  if (res.status !== 200) {
    // Alternative: Create an RPC function first, then use it
    console.log('\nTrying alternative: creating exec_sql function via postgrest...');
    
    // Let's try the sql endpoint  
    const sqlUrl = `https://${projectRef}.supabase.co/rest/v1/`;
    
    // Actually, the simplest way is to use the Supabase Dashboard SQL Editor API
    // But we need an access token for that. Let's try a different approach.
    
    // We can create a temporary function and use it
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(`https://${projectRef}.supabase.co`, serviceKey, {
      db: { schema: 'public' }
    });
    
    // Try inserting and then selecting to see if columns exist already
    const { data: testData, error: testError } = await supabase
      .from('tool_assignments')
      .select('*')
      .limit(1);
    
    if (testError) {
      console.error('Cannot access tool_assignments:', testError.message);
    } else {
      console.log('Current columns:', testData?.[0] ? Object.keys(testData[0]) : 'no rows');
      
      const hasQuantity = testData?.[0] && 'quantity' in testData[0];
      const hasSignature = testData?.[0] && 'signature' in testData[0];
      
      if (hasQuantity && hasSignature) {
        console.log('Both columns already exist!');
      } else {
        console.log('Missing columns. Need to add via Supabase Dashboard SQL Editor.');
        console.log('SQL to run:');
        console.log(sql);
      }
    }
  }
}

migrate().catch(console.error);
