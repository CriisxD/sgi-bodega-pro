'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Search, Loader2, UserPlus, FileEdit, Trash2, Save } from 'lucide-react';
import type { Worker } from '@/lib/types';
import { toast } from 'sonner';

export default function TrabajadoresPage() {
  const supabase = createClient();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [formName, setFormName] = useState('');
  const [formRut, setFormRut] = useState('');
  const [formArea, setFormArea] = useState('');
  const [formPosition, setFormPosition] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchWorkers = async () => {
    const { data } = await supabase
      .from('workers')
      .select('*')
      .order('name');
    
    setWorkers(data as Worker[] || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchWorkers();
  }, [supabase]);

  const filteredWorkers = workers.filter(w => {
    const s = search.toLowerCase();
    return w.name.toLowerCase().includes(s) || w.rut.toLowerCase().includes(s) || w.area.toLowerCase().includes(s);
  });

  const toggleWorkerStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('workers')
        .update({ active: !currentStatus })
        .eq('id', id);
        
      if (error) throw error;
      toast.success(`Trabajador ${!currentStatus ? 'activado' : 'desactivado'} exitosamente`);
      fetchWorkers();
    } catch (error: any) {
      toast.error('Error al actualizar: ' + error.message);
    }
  };

  const openNewModal = () => {
    setEditingWorker(null);
    setFormName('');
    setFormRut('');
    setFormArea('');
    setFormPosition('');
    setIsModalOpen(true);
  };

  const openEditModal = (worker: Worker) => {
    setEditingWorker(worker);
    setFormName(worker.name);
    setFormRut(worker.rut);
    setFormArea(worker.area);
    setFormPosition(worker.position);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return toast.error('El nombre es obligatorio');
    if (!formRut.trim()) return toast.error('El RUT es obligatorio');
    if (!formArea.trim()) return toast.error('El área es obligatoria');
    if (!formPosition.trim()) return toast.error('El cargo es obligatorio');

    setSaving(true);
    try {
      if (editingWorker) {
        const { error } = await supabase
          .from('workers')
          .update({
            name: formName.trim(),
            rut: formRut.trim(),
            area: formArea.trim(),
            position: formPosition.trim(),
          })
          .eq('id', editingWorker.id);
        if (error) throw error;
        toast.success('Trabajador actualizado exitosamente');
      } else {
        const { error } = await supabase
          .from('workers')
          .insert({
            name: formName.trim(),
            rut: formRut.trim(),
            area: formArea.trim(),
            position: formPosition.trim(),
          });
        if (error) throw error;
        toast.success('Trabajador creado exitosamente');
      }

      setIsModalOpen(false);
      fetchWorkers();
    } catch (error: any) {
      toast.error('Error: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredWorkers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredWorkers.map(w => w.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`¿Eliminar ${selectedIds.size} trabajadores seleccionados?`)) return;
    try {
      const { error } = await supabase.from('workers').delete().in('id', Array.from(selectedIds));
      if (error) {
        await supabase.from('workers').update({ active: false }).in('id', Array.from(selectedIds));
        toast.success(`${selectedIds.size} trabajadores desactivados (tienen historial)`);
      } else {
        toast.success(`${selectedIds.size} trabajadores eliminados`);
      }
      setSelectedIds(new Set());
      fetchWorkers();
    } catch (e: any) {
      toast.error('Error: ' + e.message);
    }
  };

  const handleBulkDeactivate = async () => {
    try {
      await supabase.from('workers').update({ active: false }).in('id', Array.from(selectedIds));
      toast.success(`${selectedIds.size} trabajadores desactivados`);
      setSelectedIds(new Set());
      fetchWorkers();
    } catch (e: any) {
      toast.error('Error: ' + e.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Trabajadores</h2>
          <p className="text-muted-foreground text-sm">
            Gestión de personal ({workers.length} registrados)
          </p>
        </div>
        <Button onClick={openNewModal}>
          <UserPlus className="w-4 h-4 mr-2" />
          Nuevo Trabajador
        </Button>
      </div>

      <Card className="card-glow border-border/50">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Listado</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, RUT o área..."
              className="pl-9 h-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-lg p-3 mb-4">
              <span className="text-sm font-medium">{selectedIds.size} trabajador(es) seleccionado(s)</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())}>
                  Deseleccionar
                </Button>
                <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={handleBulkDeactivate}>
                  Desactivar
                </Button>
                <Button size="sm" variant="destructive" onClick={handleBulkDelete}>
                  <Trash2 className="w-4 h-4 mr-1" /> Eliminar
                </Button>
              </div>
            </div>
          )}
          <div className="rounded-md border border-border/50 overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={filteredWorkers.length > 0 && selectedIds.size === filteredWorkers.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>RUT</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWorkers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No se encontraron trabajadores
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredWorkers.map(worker => (
                    <TableRow key={worker.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(worker.id)}
                          onCheckedChange={() => toggleSelect(worker.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{worker.name}</TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">{worker.rut}</TableCell>
                      <TableCell>{worker.area}</TableCell>
                      <TableCell className="text-muted-foreground">{worker.position}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={worker.active ? 'bg-success/10 text-success border-success/20' : 'bg-muted/50 text-muted-foreground'}>
                          <span className={`status-dot mr-1.5 ${worker.active ? 'active' : 'inactive'}`} />
                          {worker.active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-primary"
                            onClick={() => openEditModal(worker)}
                            title="Editar"
                          >
                            <FileEdit className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className={`h-8 w-8 ${worker.active ? 'text-destructive' : 'text-success'}`}
                            onClick={() => toggleWorkerStatus(worker.id, worker.active)}
                            title={worker.active ? 'Desactivar' : 'Activar'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* New / Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingWorker ? (
                <><FileEdit className="w-5 h-5 text-primary" /> Editar Trabajador</>
              ) : (
                <><UserPlus className="w-5 h-5 text-primary" /> Nuevo Trabajador</>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre Completo <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="Ej. Juan Pérez López"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>RUT <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="Ej. 12.345.678-9"
                  value={formRut}
                  onChange={(e) => setFormRut(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Área <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="Ej. Producción, Mantención..."
                  value={formArea}
                  onChange={(e) => setFormArea(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Cargo <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="Ej. Operador, Soldador..."
                  value={formPosition}
                  onChange={(e) => setFormPosition(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              {editingWorker ? 'Guardar Cambios' : 'Crear Trabajador'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
