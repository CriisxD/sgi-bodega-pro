'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import Papa from 'papaparse';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Loader2, PackagePlus, FileEdit, Package, Save, Upload, Download, ArrowDownAZ, ArrowUpAZ, ArrowDown01, ArrowUp10, Wand2, Trash2 } from 'lucide-react';
import type { Product, Category, ProductCategory } from '@/lib/types';
import { toast } from 'sonner';

export default function ProductosPage() {
  const supabase = createClient();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name_asc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // New/Edit modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formName, setFormName] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formStock, setFormStock] = useState(0);
  const [formMinStock, setFormMinStock] = useState(0);
  const [formUnit, setFormUnit] = useState('un');
  const [saving, setSaving] = useState(false);

  // Import modal states
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('*, category:categories(*)')
      .order('name');
    
    setProducts(data as Product[] || []);
    setLoading(false);
  };

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*').order('name');
    setCategories(data as Category[] || []);
  };

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [supabase]);

  const filteredProducts = useMemo(() => {
    let result = products.filter(p => {
      const s = search.toLowerCase();
      const matchesSearch = p.name.toLowerCase().includes(s) || (p.category?.name || '').toLowerCase().includes(s);
      const matchesTab = activeTab === 'all' || p.category?.type === activeTab;
      return matchesSearch && matchesTab;
    });

    switch (sortBy) {
      case 'name_asc':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name_desc':
        result.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'stock_asc':
        result.sort((a, b) => a.stock - b.stock);
        break;
      case 'stock_desc':
        result.sort((a, b) => b.stock - a.stock);
        break;
      case 'status':
        result.sort((a, b) => (a.active === b.active ? 0 : a.active ? -1 : 1));
        break;
    }
    return result;
  }, [products, search, activeTab, sortBy]);

  const toggleProductStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ active: !currentStatus })
        .eq('id', id);
        
      if (error) throw error;
      toast.success(`Producto ${!currentStatus ? 'activado' : 'desactivado'} exitosamente`);
      fetchProducts();
    } catch (error: any) {
      toast.error('Error al actualizar: ' + error.message);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este producto? Esto no se puede deshacer.')) return;
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) {
        // If it fails (likely due to foreign key constraints), fallback to soft delete
        toast.error('El producto tiene historial, así que fue desactivado en vez de eliminado.');
        await supabase.from('products').update({ active: false }).eq('id', id);
      } else {
        toast.success('Producto eliminado exitosamente');
      }
      fetchProducts();
    } catch (error: any) {
      toast.error('Error al eliminar: ' + error.message);
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
    if (selectedIds.size === filteredProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map(p => p.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`¿Eliminar ${selectedIds.size} productos seleccionados?`)) return;
    try {
      const { error } = await supabase.from('products').delete().in('id', Array.from(selectedIds));
      if (error) {
        // Fallback: deactivate instead
        await supabase.from('products').update({ active: false }).in('id', Array.from(selectedIds));
        toast.success(`${selectedIds.size} productos desactivados (tienen historial)`);
      } else {
        toast.success(`${selectedIds.size} productos eliminados`);
      }
      setSelectedIds(new Set());
      fetchProducts();
    } catch (e: any) {
      toast.error('Error: ' + e.message);
    }
  };

  const handleBulkDeactivate = async () => {
    try {
      await supabase.from('products').update({ active: false }).in('id', Array.from(selectedIds));
      toast.success(`${selectedIds.size} productos desactivados`);
      setSelectedIds(new Set());
      fetchProducts();
    } catch (e: any) {
      toast.error('Error: ' + e.message);
    }
  };

  const openNewModal = () => {
    setEditingProduct(null);
    setFormName('');
    setFormCategoryId('');
    setFormStock(0);
    setFormMinStock(0);
    setFormUnit('un');
    setIsModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormName(product.name);
    setFormCategoryId(product.category_id);
    setFormStock(product.stock);
    setFormMinStock(product.min_stock);
    setFormUnit(product.unit);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return toast.error('El nombre es obligatorio');
    if (!formCategoryId) return toast.error('Selecciona una categoría');

    setSaving(true);
    try {
      if (editingProduct) {
        // Update
        const { error } = await supabase
          .from('products')
          .update({
            name: formName.trim(),
            category_id: formCategoryId,
            min_stock: formMinStock,
            unit: formUnit,
          })
          .eq('id', editingProduct.id);
        if (error) throw error;
        toast.success('Producto actualizado exitosamente');
      } else {
        // Insert
        const { error } = await supabase
          .from('products')
          .insert({
            name: formName.trim(),
            category_id: formCategoryId,
            stock: formStock,
            min_stock: formMinStock,
            unit: formUnit,
          });
        if (error) throw error;
        toast.success('Producto creado exitosamente');
      }

      setIsModalOpen(false);
      fetchProducts();
    } catch (error: any) {
      toast.error('Error: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadTemplate = () => {
    const headers = 'Nombre,Categoria,Tipo_Principal,Stock_Inicial,Stock_Minimo,Unidad\n';
    const example1 = 'Guantes de Cuero,Guantes,epp,50,10,par\n';
    const example2 = 'Cemento 25kg,Materiales,material,100,20,un\n';
    const csvContent = headers + example1 + example2;
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'Plantilla_Importacion_Productos.csv';
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

          // Process sequentially to handle category creation properly
          for (const row of rows) {
            const name = row.Nombre?.trim();
            const catName = row.Categoria?.trim();
            const rawType = row.Tipo_Principal?.trim()?.toLowerCase();
            
            if (!name || !catName) {
              errorCount++;
              continue;
            }

            // Find or create category
            let catId = categories.find(c => c.name.toLowerCase() === catName.toLowerCase())?.id;
            if (!catId) {
              const validTypes = ['epp', 'material', 'herramienta', 'consumible', 'aseo'];
              const typeToSave = validTypes.includes(rawType) ? rawType : 'material';

              const { data: newCat, error: catError } = await supabase
                .from('categories')
                .insert({ name: catName, type: typeToSave })
                .select('id')
                .single();
              if (catError) {
                errorCount++;
                continue;
              }
              catId = newCat.id;
              // Add to local state so subsequent rows use it
              setCategories(prev => [...prev, { id: catId, name: catName, type: typeToSave } as Category]);
            }

            const stock = parseInt(row.Stock_Inicial) || 0;
            const minStock = parseInt(row.Stock_Minimo) || 0;
            const unit = row.Unidad?.trim()?.toLowerCase() || 'un';

            const existingProd = products.find(p => p.name.toLowerCase() === name.toLowerCase());

            if (existingProd) {
              // Update existing
              const { error: upErr } = await supabase
                .from('products')
                .update({
                  category_id: catId,
                  stock: stock, // Forcing stock update from import
                  min_stock: minStock,
                  unit: unit,
                })
                .eq('id', existingProd.id);
              
              if (upErr) errorCount++;
              else updateCount++;
            } else {
              // Insert new
              const { error: inErr } = await supabase
                .from('products')
                .insert({
                  name,
                  category_id: catId,
                  stock: stock,
                  min_stock: minStock,
                  unit: unit,
                });
                
              if (inErr) errorCount++;
              else successCount++;
            }
          }

          toast.success(`Importación finalizada. Creados: ${successCount}, Actualizados: ${updateCount}, Errores: ${errorCount}`);
          setIsImportModalOpen(false);
          fetchProducts();
          fetchCategories();
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

  const cleanupCategories = async () => {
    try {
      setLoading(true);
      toast.info('Limpiando y unificando categorías...');
      
      // 1. Fetch all categories
      const { data: allCats } = await supabase.from('categories').select('*');
      if (!allCats) return;

      // Group by lowercase name
      const grouped = allCats.reduce((acc: any, cat: any) => {
        const name = cat.name.trim().toLowerCase();
        if (!acc[name]) acc[name] = [];
        acc[name].push(cat);
        return acc;
      }, {});

      for (const [name, cats] of Object.entries(grouped)) {
        const catArray = cats as any[];
        // Fix EPP type
        let targetType = catArray[0].type;
        if (name === 'epp' || name === 'epp básico') targetType = 'epp';
        
        // If there are duplicates, merge them
        if (catArray.length > 1) {
          const keep = catArray[0];
          const removeIds = catArray.slice(1).map(c => c.id);

          // Update type if needed
          if (keep.type !== targetType) {
             await supabase.from('categories').update({ type: targetType }).eq('id', keep.id);
          }

          // Move all products to the kept category
          await supabase.from('products').update({ category_id: keep.id }).in('category_id', removeIds);

          // Delete duplicate categories
          await supabase.from('categories').delete().in('id', removeIds);
        } else {
          // Just update type if it's wrong
          if (catArray[0].type !== targetType) {
            await supabase.from('categories').update({ type: targetType }).eq('id', catArray[0].id);
          }
        }
      }

      toast.success('Categorías corregidas y unificadas');
      fetchCategories();
      fetchProducts();
    } catch (e: any) {
      toast.error('Error al limpiar: ' + e.message);
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImport(file);
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
          <h2 className="text-xl font-bold">Catálogo de Productos</h2>
          <p className="text-muted-foreground text-sm">
            Gestión del maestro de ítems ({products.length} registrados)
          </p>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={cleanupCategories} title="Unificar categorías duplicadas">
            <Wand2 className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={() => setIsImportModalOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Importar CSV
          </Button>
          <Button onClick={openNewModal}>
            <PackagePlus className="w-4 h-4 mr-2" />
            Nuevo Producto
          </Button>
        </div>
      </div>

      <Card className="card-glow border-border/50">
        <CardHeader className="pb-3 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto overflow-x-auto pb-1">
            <TabsList className="h-9">
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="material">Materiales</TabsTrigger>
              <TabsTrigger value="epp">EPP</TabsTrigger>
              <TabsTrigger value="herramienta">Herramientas</TabsTrigger>
              <TabsTrigger value="consumible">Consumibles</TabsTrigger>
              <TabsTrigger value="aseo">Aseo</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar producto..."
                className="pl-9 h-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={sortBy} onValueChange={(val) => setSortBy(val || 'name')}>
              <SelectTrigger className="w-[140px] h-9 hidden sm:flex">
                <SelectValue placeholder="Ordenar por..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name_asc"><div className="flex items-center"><ArrowDownAZ className="w-4 h-4 mr-2" /> A - Z</div></SelectItem>
                <SelectItem value="name_desc"><div className="flex items-center"><ArrowUpAZ className="w-4 h-4 mr-2" /> Z - A</div></SelectItem>
                <SelectItem value="stock_asc"><div className="flex items-center"><ArrowDown01 className="w-4 h-4 mr-2" /> Menor Stock</div></SelectItem>
                <SelectItem value="stock_desc"><div className="flex items-center"><ArrowUp10 className="w-4 h-4 mr-2" /> Mayor Stock</div></SelectItem>
                <SelectItem value="status">Estado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-lg p-3 mb-4">
              <span className="text-sm font-medium">{selectedIds.size} producto(s) seleccionado(s)</span>
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
                      checked={filteredProducts.length > 0 && selectedIds.size === filteredProducts.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead className="hidden sm:table-cell">Categoría</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="hidden md:table-cell text-right">Mínimo</TableHead>
                  <TableHead className="hidden lg:table-cell">Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No se encontraron productos
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map(product => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(product.id)}
                          onCheckedChange={() => toggleSelect(product.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-muted-foreground" />
                          {product.name}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground text-xs">
                        {product.category?.name}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        <span className={product.stock <= product.min_stock ? 'text-destructive' : 'text-success'}>
                          {product.stock}
                        </span> {product.unit}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-right text-muted-foreground">
                        {product.min_stock}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Badge variant="outline" className={product.active ? 'bg-success/10 text-success border-success/20' : 'bg-muted/50 text-muted-foreground'}>
                          <span className={`status-dot mr-1.5 ${product.active ? 'active' : 'inactive'}`} />
                          {product.active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-primary"
                            onClick={() => openEditModal(product)}
                            title="Editar"
                          >
                            <FileEdit className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className={`h-8 w-8 ${product.active ? 'text-destructive' : 'text-success'}`}
                            onClick={() => toggleProductStatus(product.id, product.active)}
                            title={product.active ? 'Desactivar' : 'Activar'}
                          >
                            <Package className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteProduct(product.id)}
                            title="Eliminar permanentemente"
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
              {editingProduct ? (
                <><FileEdit className="w-5 h-5 text-primary" /> Editar Producto</>
              ) : (
                <><PackagePlus className="w-5 h-5 text-primary" /> Nuevo Producto</>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre del Producto <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Ej. Guantes de cuero"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Categoría <span className="text-destructive">*</span></Label>
              <Select value={formCategoryId} onValueChange={(v) => setFormCategoryId(v || '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar categoría..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name} ({cat.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {!editingProduct && (
                <div className="space-y-2">
                  <Label>Stock Inicial</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formStock}
                    onChange={(e) => setFormStock(parseInt(e.target.value) || 0)}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Stock Mínimo</Label>
                <Input
                  type="number"
                  min="0"
                  value={formMinStock}
                  onChange={(e) => setFormMinStock(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>Unidad</Label>
                <Select value={formUnit} onValueChange={(v) => setFormUnit(v || 'un')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="un">un (Unidad)</SelectItem>
                    <SelectItem value="par">par (Par)</SelectItem>
                    <SelectItem value="mt">mt (Metro)</SelectItem>
                    <SelectItem value="kg">kg (Kilo)</SelectItem>
                    <SelectItem value="lt">lt (Litro)</SelectItem>
                    <SelectItem value="rollo">rollo</SelectItem>
                    <SelectItem value="caja">caja</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              {editingProduct ? 'Guardar Cambios' : 'Crear Producto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Import Modal */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" /> Importación Masiva
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="bg-muted/50 p-4 rounded-lg border border-border text-sm space-y-3">
              <p>Para asegurar una importación exitosa, sigue estos pasos:</p>
              <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
                <li>Descarga la plantilla CSV.</li>
                <li>Llénala con tus productos (en Excel, usa "Guardar como CSV").</li>
                <li>Sube el archivo aquí.</li>
              </ol>
              <p className="text-xs text-muted-foreground pt-2 border-t border-border/50">
                Nota: Si la categoría no existe, se creará. En ese caso, llena la columna <b>Tipo_Principal</b> con: <i>epp, material, herramienta, consumible, o aseo</i>. Si el producto ya existe, se actualizará su stock.
              </p>
            </div>

            <Button variant="outline" className="w-full" onClick={handleDownloadTemplate}>
              <Download className="w-4 h-4 mr-2" /> Descargar Plantilla CSV
            </Button>

            <div className="space-y-2">
              <Label>Subir Archivo CSV Lleno</Label>
              <div className="flex items-center gap-2">
                <Input 
                  type="file" 
                  accept=".csv" 
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  disabled={importing}
                />
              </div>
              {importing && (
                <div className="flex items-center gap-2 text-sm text-primary mt-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Procesando importación...
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
