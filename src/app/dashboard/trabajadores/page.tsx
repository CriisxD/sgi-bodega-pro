'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Papa from 'papaparse';
import { usePersistentState } from '@/hooks/use-persistent-state';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Search, 
  Loader2, 
  UserPlus, 
  FileEdit, 
  Trash2, 
  Save, 
  Upload, 
  Download, 
  LayoutGrid, 
  List, 
  RotateCcw, 
  SlidersHorizontal 
} from 'lucide-react';
import type { Worker } from '@/lib/types';
import { toast } from 'sonner';

function cleanAndFormatRut(rut: string): string {
  const cleanRut = rut.trim();
  if (cleanRut.toUpperCase().startsWith('TEMP-')) return cleanRut.toUpperCase();
  
  // Remove dots, dashes, and spaces
  const clean = cleanRut.replace(/[^0-9kK]/g, '').toUpperCase();
  if (clean.length < 2) return clean;
  
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  
  // Format body with dots
  let formatted = '';
  for (let i = body.length - 1, j = 0; i >= 0; i--, j++) {
    if (j > 0 && j % 3 === 0) {
      formatted = '.' + formatted;
    }
    formatted = body[i] + formatted;
  }
  
  return `${formatted}-${dv}`;
}

export default function TrabajadoresPage() {
  const supabase = createClient();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filters & Views
  const [areaFilter, setAreaFilter] = usePersistentState<string>('trabajadores-areaFilter', 'all');
  const [positionFilter, setPositionFilter] = usePersistentState<string>('trabajadores-positionFilter', 'all');
  const [statusFilter, setStatusFilter] = usePersistentState<string>('trabajadores-statusFilter', 'all');
  const [viewMode, setViewMode] = usePersistentState<'table' | 'cards'>('trabajadores-viewMode', 'table');
  const [sortBy, setSortBy] = usePersistentState<string>('trabajadores-sortBy', 'name_asc');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [formName, setFormName] = useState('');
  const [formRut, setFormRut] = useState('');
  const [formArea, setFormArea] = useState('');
  const [formPosition, setFormPosition] = useState('');
  const [saving, setSaving] = useState(false);

  // Import modal states
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const uniqueAreas = useMemo(() => {
    const areas = new Set(workers.map(w => w.area).filter(Boolean));
    return Array.from(areas).sort();
  }, [workers]);

  const uniquePositions = useMemo(() => {
    const positions = new Set(workers.map(w => w.position).filter(Boolean));
    return Array.from(positions).sort();
  }, [workers]);

  const filteredWorkers = useMemo(() => {
    let result = workers.filter(w => {
      const s = search.toLowerCase();
      const matchesSearch = 
        w.name.toLowerCase().includes(s) || 
        w.rut.toLowerCase().includes(s) || 
        w.area.toLowerCase().includes(s) || 
        w.position.toLowerCase().includes(s);

      const matchesArea = areaFilter === 'all' || w.area === areaFilter;
      const matchesPosition = positionFilter === 'all' || w.position === positionFilter;
      
      let matchesStatus = true;
      if (statusFilter === 'active') matchesStatus = w.active;
      else if (statusFilter === 'inactive') matchesStatus = !w.active;

      return matchesSearch && matchesArea && matchesPosition && matchesStatus;
    });

    switch (sortBy) {
      case 'name_asc':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name_desc':
        result.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'rut_asc':
        result.sort((a, b) => a.rut.localeCompare(b.rut));
        break;
      case 'area_asc':
        result.sort((a, b) => a.area.localeCompare(b.area));
        break;
      case 'position_asc':
        result.sort((a, b) => a.position.localeCompare(b.position));
        break;
    }

    return result;
  }, [workers, search, areaFilter, positionFilter, statusFilter, sortBy]);

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
      const formattedRut = cleanAndFormatRut(formRut.trim());
      
      // Check for duplicates
      if (editingWorker) {
        const duplicate = workers.find(w => 
          w.rut.toLowerCase().replace(/[\.\-]/g, '') === formattedRut.toLowerCase().replace(/[\.\-]/g, '') && 
          w.id !== editingWorker.id
        );
        if (duplicate) {
          toast.error(`El RUT ${formattedRut} ya está registrado para el trabajador ${duplicate.name}`);
          setSaving(false);
          return;
        }
        
        const { error } = await supabase
          .from('workers')
          .update({
            name: formName.trim(),
            rut: formattedRut,
            area: formArea.trim(),
            position: formPosition.trim(),
          })
          .eq('id', editingWorker.id);
        if (error) throw error;
        toast.success('Trabajador actualizado exitosamente');
      } else {
        const duplicate = workers.find(w => 
          w.rut.toLowerCase().replace(/[\.\-]/g, '') === formattedRut.toLowerCase().replace(/[\.\-]/g, '')
        );
        if (duplicate) {
          toast.error(`El RUT ${formattedRut} ya está registrado para el trabajador ${duplicate.name}`);
          setSaving(false);
          return;
        }

        const { error } = await supabase
          .from('workers')
          .insert({
            name: formName.trim(),
            rut: formattedRut,
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
      const { error } = await supabase.from('workers').update({ active: false }).in('id', Array.from(selectedIds));
      if (error) throw error;
      toast.success(`${selectedIds.size} trabajadores desactivados`);
      setSelectedIds(new Set());
      fetchWorkers();
    } catch (e: any) {
      toast.error('Error: ' + e.message);
    }
  };

  const handleBulkActivate = async () => {
    try {
      const { error } = await supabase.from('workers').update({ active: true }).in('id', Array.from(selectedIds));
      if (error) throw error;
      toast.success(`${selectedIds.size} trabajadores activados`);
      setSelectedIds(new Set());
      fetchWorkers();
    } catch (e: any) {
      toast.error('Error: ' + e.message);
    }
  };

  const handleDownloadTemplate = () => {
    const headers = 'APELLIDO PATER,APELLIDO MATER,NOMBRES,UBICACIÓN,RUT,Cargo\n';
    const example1 = 'Silva,Muñoz,Ana,Producción,44.444.444-4,Empaquetador\n';
    const example2 = 'Pérez,,Juan,Mantenimiento,11.111.111-1,Operador\n';
    const csvContent = headers + example1 + example2;
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'Plantilla_Importacion_Trabajadores.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const processImport = async (file: File) => {
    setImporting(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = results.data as any[];
          if (rows.length === 0) throw new Error('El archivo está vacío');

          let successCount = 0;
          let updateCount = 0;
          let errorCount = 0;
          let tempRutCount = 0;
          let localWorkers = [...workers];

          for (const row of rows) {
            // Combine names if split, or use Nombre
            let name = row.Nombre?.trim() || row.nombre?.trim();
            if (!name) {
              const nameKeys = Object.keys(row);
              const pKey = nameKeys.find(k => k.toLowerCase().includes('paterno') || k.toLowerCase().includes('pater'));
              const mKey = nameKeys.find(k => k.toLowerCase().includes('materno') || k.toLowerCase().includes('mater'));
              const nKey = nameKeys.find(k => k.toLowerCase() === 'nombres' || k.toLowerCase() === 'nombre' || k.toLowerCase() === 'nombres');
              
              const paterno = pKey ? row[pKey]?.trim() : '';
              const materno = mKey ? row[mKey]?.trim() : '';
              const nombres = nKey ? row[nKey]?.trim() : '';
              
              if (paterno || materno || nombres) {
                name = `${nombres} ${paterno} ${materno}`.replace(/\s+/g, ' ').trim();
              }
            }

            if (!name) {
              errorCount++;
              continue;
            }

            // Determine RUT
            const nameKeys = Object.keys(row);
            const rKey = nameKeys.find(k => k.toLowerCase() === 'rut' || k.toLowerCase() === 'rut');
            let rut = rKey ? row[rKey]?.trim() : '';
            
            if (!rut) {
              const randHex = Math.floor(Math.random() * 16777215).toString(16).padEnd(6, '0');
              rut = `TEMP-${randHex}`;
              tempRutCount++;
            } else {
              rut = cleanAndFormatRut(rut);
            }

            const aKey = nameKeys.find(k => k.toLowerCase() === 'area' || k.toLowerCase().includes('área') || k.toLowerCase().includes('ubicación') || k.toLowerCase().includes('ubicacion'));
            const cKey = nameKeys.find(k => k.toLowerCase() === 'cargo' || k.toLowerCase().includes('posición') || k.toLowerCase().includes('posicion'));
            
            const area = aKey ? row[aKey]?.trim() : 'Sin Área';
            const position = cKey ? row[cKey]?.trim() : 'Operario';

            const normalizedRut = rut.toLowerCase().replace(/[\.\-]/g, '');
            const existingWorker = localWorkers.find(w => w.rut.toLowerCase().replace(/[\.\-]/g, '') === normalizedRut);

            if (existingWorker) {
              const { error: upErr } = await supabase
                .from('workers')
                .update({
                  name,
                  area,
                  position,
                })
                .eq('id', existingWorker.id);
              
              if (upErr) {
                errorCount++;
              } else {
                updateCount++;
                existingWorker.name = name;
                existingWorker.area = area;
                existingWorker.position = position;
              }
            } else {
              const { data: insertedData, error: inErr } = await supabase
                .from('workers')
                .insert({
                  rut,
                  name,
                  area,
                  position,
                  active: true
                })
                .select();
                
              if (inErr) {
                errorCount++;
              } else {
                successCount++;
                if (insertedData && insertedData[0]) {
                  localWorkers.push(insertedData[0]);
                }
              }
            }
          }

          let msg = `Importación finalizada. Creados: ${successCount}, Actualizados: ${updateCount}`;
          if (tempRutCount > 0) msg += `, RUTs Temporales: ${tempRutCount}`;
          if (errorCount > 0) msg += `, Errores: ${errorCount}`;

          toast.success(msg);
          setIsImportModalOpen(false);
          fetchWorkers();
        } catch (err: any) {
          toast.error('Error al procesar el archivo: ' + err.message);
        } finally {
          setImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      },
      error: (error) => {
        toast.error('Error al leer el CSV: ' + error.message);
        setImporting(false);
      }
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processImport(file);
  };

  const handleExportCSV = () => {
    if (filteredWorkers.length === 0) {
      toast.error('No hay trabajadores para exportar');
      return;
    }

    const headers = 'RUT,Nombre,Area,Cargo,Estado\n';
    const csvContent = headers + filteredWorkers.map(w => 
      `"${w.rut}","${w.name}","${w.area}","${w.position}","${w.active ? 'Activo' : 'Inactivo'}"`
    ).join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Trabajadores_Exportados_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Lista de trabajadores exportada con éxito');
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
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Trabajadores</h2>
          <p className="text-muted-foreground text-sm">
            Gestión del personal de obra y bodega ({workers.length} registrados)
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
          <Button variant="outline" size="sm" onClick={() => setIsImportModalOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Importar CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
          <Button size="sm" onClick={openNewModal}>
            <UserPlus className="w-4 h-4 mr-2" />
            Nuevo Trabajador
          </Button>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <Card className="border-border/50 bg-card/60 backdrop-blur-md">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
            {/* Search */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, RUT, cargo, área..."
                className="pl-9 h-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Dropdown Filters & Controls */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Filter Area */}
              <div className="w-[140px]">
                <Select value={areaFilter} onValueChange={(val) => setAreaFilter(val || 'all')}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Área">
                      {areaFilter === 'all' ? 'Todas las Áreas' : areaFilter}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las Áreas</SelectItem>
                    {uniqueAreas.map(a => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Filter Position */}
              <div className="w-[140px]">
                <Select value={positionFilter} onValueChange={(val) => setPositionFilter(val || 'all')}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Cargo">
                      {positionFilter === 'all' ? 'Todos los Cargos' : positionFilter}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los Cargos</SelectItem>
                    {uniquePositions.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Filter Status */}
              <div className="w-[120px]">
                <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val || 'all')}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Estado">
                      {statusFilter === 'all' && 'Todos'}
                      {statusFilter === 'active' && 'Activos'}
                      {statusFilter === 'inactive' && 'Inactivos'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Activos</SelectItem>
                    <SelectItem value="inactive">Inactivos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sort By */}
              <div className="w-[150px]">
                <Select value={sortBy} onValueChange={(val) => setSortBy(val || 'name_asc')}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Ordenar por">
                      {sortBy === 'name_asc' && 'Nombre (A-Z)'}
                      {sortBy === 'name_desc' && 'Nombre (Z-A)'}
                      {sortBy === 'rut_asc' && 'RUT'}
                      {sortBy === 'area_asc' && 'Área (A-Z)'}
                      {sortBy === 'position_asc' && 'Cargo (A-Z)'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name_asc">Nombre (A-Z)</SelectItem>
                    <SelectItem value="name_desc">Nombre (Z-A)</SelectItem>
                    <SelectItem value="rut_asc">RUT</SelectItem>
                    <SelectItem value="area_asc">Área (A-Z)</SelectItem>
                    <SelectItem value="position_asc">Cargo (A-Z)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Reset Filters */}
              {(areaFilter !== 'all' || positionFilter !== 'all' || statusFilter !== 'all' || search !== '' || sortBy !== 'name_asc') && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setAreaFilter('all');
                    setPositionFilter('all');
                    setStatusFilter('all');
                    setSearch('');
                    setSortBy('name_asc');
                  }}
                  className="h-9 w-9 text-muted-foreground hover:text-foreground"
                  title="Restablecer filtros"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              )}

              {/* View Mode Toggle */}
              <div className="border border-border rounded-lg p-0.5 flex items-center gap-0.5 bg-background">
                <Button
                  variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-8 w-8 rounded-md"
                  onClick={() => setViewMode('table')}
                  title="Vista de Tabla"
                >
                  <List className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-8 w-8 rounded-md"
                  onClick={() => setViewMode('cards')}
                  title="Vista de Tarjetas"
                >
                  <LayoutGrid className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selected Items Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-xl p-3 animate-in fade-in-50">
          <span className="text-sm font-medium">{selectedIds.size} trabajador(es) seleccionado(s)</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())}>
              Deseleccionar
            </Button>
            <Button size="sm" variant="outline" className="text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10" onClick={handleBulkActivate}>
              Activar
            </Button>
            <Button size="sm" variant="outline" className="text-amber-400 border-amber-500/30 hover:bg-amber-500/10" onClick={handleBulkDeactivate}>
              Desactivar
            </Button>
            <Button size="sm" variant="destructive" onClick={handleBulkDelete}>
              <Trash2 className="w-4 h-4 mr-1.5" /> Eliminar
            </Button>
          </div>
        </div>
      )}

      {/* Main List */}
      {viewMode === 'table' ? (
        <Card className="card-glow border-border/50 overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/30">
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
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      No se encontraron trabajadores con los filtros actuales
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredWorkers.map(worker => (
                    <TableRow 
                      key={worker.id} 
                      className={`hover:bg-muted/10 transition-colors ${selectedIds.has(worker.id) ? 'bg-primary/5' : ''}`}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(worker.id)}
                          onCheckedChange={() => toggleSelect(worker.id)}
                        />
                      </TableCell>
                      <TableCell className="font-semibold text-foreground">{worker.name}</TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">{worker.rut}</TableCell>
                      <TableCell>{worker.area}</TableCell>
                      <TableCell className="text-muted-foreground">{worker.position}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={worker.active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-muted/50 text-muted-foreground border-border'}>
                          <span className={`status-dot mr-1.5 ${worker.active ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
                          {worker.active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
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
          </CardContent>
        </Card>
      ) : (
        /* Cards View (Grid) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWorkers.length === 0 ? (
            <Card className="col-span-full border-border/50 py-12 text-center text-muted-foreground">
              No se encontraron trabajadores con los filtros actuales
            </Card>
          ) : (
            filteredWorkers.map(worker => (
              <Card 
                key={worker.id} 
                className={`card-glow border-border/50 hover:border-primary/20 transition-all flex flex-col justify-between ${
                  selectedIds.has(worker.id) ? 'ring-1 ring-primary border-primary/40 bg-primary/5' : ''
                }`}
              >
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h3 className="font-bold text-base text-foreground leading-tight">{worker.name}</h3>
                      <p className="text-xs font-mono text-muted-foreground">{worker.rut}</p>
                    </div>
                    <Checkbox
                      checked={selectedIds.has(worker.id)}
                      onCheckedChange={() => toggleSelect(worker.id)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm pt-2 border-t border-border/50">
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Área</span>
                      <span className="font-medium text-foreground">{worker.area}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Cargo</span>
                      <span className="font-medium text-foreground">{worker.position}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-border/50">
                    <Badge variant="outline" className={worker.active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-muted/50 text-muted-foreground border-border'}>
                      <span className={`status-dot mr-1.5 ${worker.active ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
                      {worker.active ? 'Activo' : 'Inactivo'}
                    </Badge>

                    <div className="flex items-center gap-1">
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
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

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
                  placeholder="Ej. Juan Silva Pérez"
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
                  placeholder="Ej. Operador, Técnico..."
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

      {/* Import CSV Modal */}
      {/* Import CSV Modal */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" /> Importar Lista de Trabajadores
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <p className="text-sm text-muted-foreground">
              Puedes importar tu lista de personal directamente subiendo un archivo CSV. El importador detecta automáticamente las columnas de tu Excel (BD Personal):
            </p>

            {/* Excel Structure Preview */}
            <div className="border border-border/50 rounded-xl overflow-hidden bg-muted/20 text-xs">
              <div className="bg-muted/50 px-3.5 py-2 font-semibold border-b border-border flex justify-between items-center">
                <span className="text-foreground">Estructura de Columnas Soportada</span>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                  Compatible con tu Excel
                </Badge>
              </div>
              <div className="p-3 overflow-x-auto">
                <table className="w-full border-collapse border border-border/40 text-left font-mono">
                  <thead>
                    <tr className="bg-muted/40">
                      <th className="border border-border/40 px-2 py-1.5 text-[10px] font-bold text-foreground">APELLIDO PATER</th>
                      <th className="border border-border/40 px-2 py-1.5 text-[10px] font-bold text-foreground">APELLIDO MATER</th>
                      <th className="border border-border/40 px-2 py-1.5 text-[10px] font-bold text-foreground">NOMBRES</th>
                      <th className="border border-border/40 px-2 py-1.5 text-[10px] font-bold text-foreground">UBICACIÓN</th>
                      <th className="border border-border/40 px-2 py-1.5 text-[10px] font-bold text-foreground">RUT <span className="text-muted-foreground font-normal">(Opcional)</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-background/40">
                      <td className="border border-border/40 px-2 py-1.5 text-muted-foreground">Silva</td>
                      <td className="border border-border/40 px-2 py-1.5 text-muted-foreground">Muñoz</td>
                      <td className="border border-border/40 px-2 py-1.5 text-muted-foreground">Ana Maria</td>
                      <td className="border border-border/40 px-2 py-1.5 text-muted-foreground">Producción</td>
                      <td className="border border-border/40 px-2 py-1.5 text-muted-foreground text-[10px]">44.444.444-4</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="px-3.5 py-2 bg-muted/30 border-t border-border/30 text-[11px] text-muted-foreground space-y-1">
                <p>💡 <span className="font-medium text-foreground">Notas de importación:</span></p>
                <ul className="list-disc list-inside space-y-0.5 pl-1">
                  <li>Si un trabajador no tiene RUT, el sistema le asignará un <span className="font-semibold text-foreground">RUT temporal</span> para permitir su registro.</li>
                  <li>Si el RUT ya existe, los datos del trabajador (Nombre, Área, Cargo) se <span className="font-semibold text-foreground">actualizarán</span> en lugar de duplicarse.</li>
                </ul>
              </div>
            </div>

            <Button variant="outline" className="w-full h-10 hover:bg-muted" onClick={handleDownloadTemplate}>
              <Download className="w-4 h-4 mr-2 text-primary" /> Descargar Plantilla CSV de Ejemplo
            </Button>

            <div className="space-y-2 pt-2 border-t border-border/50">
              <Label className="text-sm font-semibold">Seleccionar archivo CSV</Label>
              <Input 
                type="file" 
                accept=".csv" 
                ref={fileInputRef}
                onChange={handleFileUpload}
                disabled={importing}
                className="h-10 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
              />
              {importing && (
                <div className="flex items-center justify-center gap-2 text-sm text-primary py-2 bg-primary/5 rounded-lg border border-primary/10 animate-pulse mt-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Procesando e importando trabajadores...
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
