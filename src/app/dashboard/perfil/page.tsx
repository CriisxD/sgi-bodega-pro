'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Save, User, KeyRound, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function PerfilPage() {
  const { user, profile, refreshProfile } = useAuth();
  const supabase = createClient();
  
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState('');
  
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
    }
  }, [profile]);

  const handleUpdateProfile = async () => {
    if (!profile) return;
    if (!fullName.trim()) return toast.error('El nombre no puede estar vacío');
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName.trim() })
        .eq('id', profile.id);
        
      if (error) throw error;
      
      await refreshProfile();
      toast.success('Perfil actualizado correctamente');
    } catch (e: any) {
      toast.error('Error al actualizar perfil: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      return toast.error('La contraseña debe tener al menos 6 caracteres');
    }
    if (newPassword !== confirmPassword) {
      return toast.error('Las contraseñas no coinciden');
    }
    
    setLoadingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (error) throw error;
      
      toast.success('Contraseña actualizada con éxito');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      toast.error('Error al actualizar contraseña: ' + e.message);
    } finally {
      setLoadingPassword(false);
    }
  };

  if (!profile) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const roleLabels: Record<string, string> = {
    admin: 'Administrador',
    bodeguero: 'Bodeguero',
    supervisor: 'Supervisor',
    prevencionista: 'Prevencionista',
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <div>
        <h2 className="text-2xl font-bold">Mi Perfil</h2>
        <p className="text-muted-foreground">Configura tus datos personales y credenciales de acceso</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Datos Personales */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="w-5 h-5 text-primary" />
              Datos Personales
            </CardTitle>
            <CardDescription>
              Actualiza tu nombre y revisa tu rol en el sistema.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre Completo</Label>
              <Input 
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ej. Juan Pérez"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Correo Electrónico (No editable)</Label>
              <Input 
                value={user?.email || ''}
                disabled
                className="bg-muted/50 text-muted-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label>Rol en el Sistema</Label>
              <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-md border border-border/50">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <span className="font-medium capitalize">{roleLabels[profile.role] || profile.role}</span>
              </div>
            </div>

            <Button 
              className="w-full mt-2" 
              onClick={handleUpdateProfile} 
              disabled={loading || fullName === profile.full_name}
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Guardar Cambios
            </Button>
          </CardContent>
        </Card>

        {/* Seguridad */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <KeyRound className="w-5 h-5 text-primary" />
              Seguridad
            </CardTitle>
            <CardDescription>
              Cambia tu contraseña de acceso a la plataforma.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nueva Contraseña</Label>
              <Input 
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Confirmar Contraseña</Label>
              <Input 
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite la contraseña"
              />
            </div>

            <Button 
              className="w-full mt-2" 
              variant="outline"
              onClick={handleUpdatePassword} 
              disabled={loadingPassword || !newPassword || !confirmPassword}
            >
              {loadingPassword ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Actualizar Contraseña
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
