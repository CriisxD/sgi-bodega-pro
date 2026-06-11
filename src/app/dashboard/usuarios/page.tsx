import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { UserFormModal } from './components/UserFormModal';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = {
  title: 'Gestión de Usuarios | SGI Bodega',
};

const roleColors: Record<string, string> = {
  admin: 'bg-red-500/10 text-red-500 hover:bg-red-500/20',
  supervisor: 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20',
  bodeguero: 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20',
  prevencionista: 'bg-green-500/10 text-green-500 hover:bg-green-500/20',
};

export default async function UsuariosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Verifica si es admin
  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (currentProfile?.role !== 'admin') {
    redirect('/dashboard'); // No autorizado
  }

  // Obtener todos los usuarios
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching profiles:', error);
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Usuarios</h2>
          <p className="text-muted-foreground">
            Administra los accesos y permisos del personal al sistema.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <UserFormModal />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cuentas Activas</CardTitle>
          <CardDescription>
            Mostrando todos los perfiles sincronizados actualmente en el sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Área</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles?.map((profile) => (
                <TableRow key={profile.id}>
                  <TableCell className="font-medium">{profile.full_name}</TableCell>
                  <TableCell>{profile.email}</TableCell>
                  <TableCell>
                    <Badge className={roleColors[profile.role] || 'bg-gray-500/10 text-gray-500'} variant="outline">
                      {profile.role?.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>{profile.area || 'N/A'}</TableCell>
                  <TableCell className="text-right">
                    <UserFormModal userToEdit={profile} />
                  </TableCell>
                </TableRow>
              ))}
              {!profiles?.length && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    No se encontraron usuarios.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
