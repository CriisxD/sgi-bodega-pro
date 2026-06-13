'use server';

import { createClient } from '@supabase/supabase-js';

const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  supabaseKey
);

export async function saveSignatureRemote(valeId: string, signatureBase64: string) {
  try {
    const { error } = await supabaseAdmin
      .from('vales')
      .update({ signature: signatureBase64 })
      .eq('id', valeId);

    if (error) throw error;
    
    return { success: true };
  } catch (error: any) {
    console.error('Error saving signature:', error);
    return { success: false, error: error.message };
  }
}

export async function getValeForSignature(valeId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('vales')
      .select('id, vale_number, worker:workers(name), items:vale_items(quantity, product:products(name)), status')
      .eq('id', valeId)
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
