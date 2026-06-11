'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createAdminUser, updateUserProfile, deleteAdminUser } from '@/app/actions/userActions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PlusCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface UserFormModalProps {
  userToEdit?: any; // If provided, modal acts in edit mode
}

export function UserFormModal({ userToEdit }: UserFormModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    email: userToEdit?.email || '',
    password: '',
    full_name: userToEdit?.full_name || '',
    role: userToEdit?.role || 'bodeguero',
    area: userToEdit?.area || '',
  });

  const isEdit = !!userToEdit;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isEdit) {
        const { success, error } = await updateUserProfile(userToEdit.id, formData);
        if (!success) throw new Error(error);
        toast.success('Usuario actualizado exitosamente');
      } else {
        const { success, error } = await createAdminUser(formData as any);
        if (!success) throw new Error(error);
        toast.success('Usuario creado exitosamente');
      }
      setOpen(false);
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || 'Error al guardar el usuario');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        isEdit ? (
          <Button variant="outline" size="sm">Editar</Button>
        ) : (
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Crear Usuario
          </Button>
        )
      } />
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Usuario' : 'Crear Nuevo Usuario'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Modifica los permisos o datos de este usuario.' : 'Crea una cuenta autorizada para acceder al sistema.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {!isEdit && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="email">Correo Electrónico</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    required 
                    value={formData.email} 
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input 
                    id="password" 
                    type="text" 
                    placeholder="Generada automáticamente si se deja vacío"
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
              </>
            )}
            
            <div className="grid gap-2">
              <Label htmlFor="full_name">Nombre Completo</Label>
              <Input 
                id="full_name" 
                required 
                value={formData.full_name} 
                onChange={e => setFormData({ ...formData, full_name: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="role">Rol en el Sistema</Label>
              <Select 
                value={formData.role} 
                onValueChange={(val) => setFormData({ ...formData, role: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="bodeguero">Bodeguero</SelectItem>
                  <SelectItem value="prevencionista">Prevencionista</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="area">Área / Departamento (Opcional)</Label>
              <Input 
                id="area" 
                placeholder="Ej: Mantenimiento"
                value={formData.area} 
                onChange={e => setFormData({ ...formData, area: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? 'Guardando...' : 'Guardar Usuario'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
