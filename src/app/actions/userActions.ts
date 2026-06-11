'use server';

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

// Tipos requeridos
type UserRole = 'admin' | 'bodeguero' | 'supervisor' | 'prevencionista';

interface CreateUserData {
  email: string;
  password?: string;
  full_name: string;
  role: UserRole;
  area?: string;
}

export async function createAdminUser(data: CreateUserData) {
  try {
    // 1. Verify caller is admin
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      return { success: false, error: 'No autorizado.' };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .single();

    if (profile?.role !== 'admin') {
      return { success: false, error: 'Privilegios insuficientes.' };
    }

    // 2. Create the user using Admin API
    const password = data.password || Math.random().toString(36).slice(-8) + 'A1!'; // Default secure password if none provided
    
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: data.full_name,
        role: data.role,
      },
    });

    if (createError) {
      console.error('Auth Create Error:', createError);
      return { success: false, error: createError.message };
    }

    // 3. The newly created user should have triggered `handle_new_user` in DB 
    // which inserts them into the `profiles` table. 
    // However, our strict trigger fallback might have set them to 'Nuevo Usuario' and 'bodeguero'
    // To ensure exact metadata, we explicitly update the profile as admin.
    
    if (newUser.user) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({
          full_name: data.full_name,
          role: data.role,
          area: data.area || null,
        })
        .eq('id', newUser.user.id);

      if (profileError) {
        console.error('Profile Update Error:', profileError);
        return { success: false, error: 'Usuario creado pero falló actualizar su perfil.' };
      }
    }

    revalidatePath('/dashboard/usuarios');
    return { success: true };
  } catch (err: any) {
    console.error('createAdminUser fallback error:', err);
    return { success: false, error: err.message || 'Error desconocido' };
  }
}

export async function updateUserProfile(userId: string, data: Partial<CreateUserData>) {
  try {
    // 1. Verify caller is admin
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();

    if (!authData.user) return { success: false, error: 'No autorizado.' };

    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .single();

    if (currentProfile?.role !== 'admin') {
      return { success: false, error: 'Privilegios insuficientes.' };
    }

    // 2. Update via Admin API to override RLS and ensure success
    const updates: any = {};
    if (data.full_name) updates.full_name = data.full_name;
    if (data.role) updates.role = data.role;
    if (data.area !== undefined) updates.area = data.area;

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', userId);

    if (updateError) throw updateError;

    // Optional: If you want to sync role/full_name back to auth metadata
    if (data.full_name || data.role) {
      const { data: existingUser } = await supabaseAdmin.auth.admin.getUserById(userId);
      const currentMeta = existingUser.user?.user_metadata || {};
      
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: {
           ...currentMeta,
           ...(data.full_name && { full_name: data.full_name }),
           ...(data.role && { role: data.role })
        }
      });
    }

    revalidatePath('/dashboard/usuarios');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteAdminUser(userId: string) {
    try {
        const supabase = await createClient();
        const { data: authData } = await supabase.auth.getUser();
    
        if (!authData.user) return { success: false, error: 'No autorizado.' };
    
        const { data: currentProfile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', authData.user.id)
          .single();
    
        if (currentProfile?.role !== 'admin') {
          return { success: false, error: 'Privilegios insuficientes.' };
        }
    
        // Deleting the user from auth.users will cascade delete the profile
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
        
        if(error) throw error;
        
        revalidatePath('/dashboard/usuarios');
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}
