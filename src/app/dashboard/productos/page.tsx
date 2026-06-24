'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { usePersistentState } from '@/hooks/use-persistent-state';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Loader2, PackagePlus, FileEdit, Package, Save, Upload, Download, ArrowDownAZ, ArrowUpAZ, ArrowDown01, ArrowUp10, Wand2, Trash2, Tags, PackageX, PackageCheck } from 'lucide-react';
import type { Product, Category, ProductCategory } from '@/lib/types';
import { toast } from 'sonner';

type ImportPreviewRow = {
  originalName: string;
  name: string;
  stock: number;
  minStock: number;
  unit: string;
  status: 'new' | 'update' | 'error';
  productId?: string;
  errorMessage?: string;
};

export default function ProductosPage() {
  const supabase = createClient();
  const { profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = usePersistentState<string>('productos-activeTab', 'all');
  const [sortBy, setSortBy] = usePersistentState<string>('productos-sortBy', 'name_asc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // New/Edit modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formName, setFormName] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formStock, setFormStock] = useState<number | string>(0);
  const [formMinStock, setFormMinStock] = useState<number | string>(0);
  const [formUnitBase, setFormUnitBase] = useState('un');
  const [formUnitDetail, setFormUnitDetail] = useState('');
  const [formBrand, setFormBrand] = useState('');
  const [saving, setSaving] = useState(false);

  // Import modal states
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importCategoryId, setImportCategoryId] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<ImportPreviewRow[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Category modal states
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryType, setNewCategoryType] = useState('');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);

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

  const handleAddCategory = async () => {
    if (!newCategoryName.trim() || !newCategoryType.trim()) return;
    try {
      if (editingCatId) {
        const { error } = await supabase.from('categories').update({ name: newCategoryName.trim(), type: newCategoryType.trim().toLowerCase() }).eq('id', editingCatId);
        if (error) throw error;
        toast.success('Categoría actualizada');
      } else {
        const { error } = await supabase.from('categories').insert({ name: newCategoryName.trim(), type: newCategoryType.trim().toLowerCase() });
        if (error) throw error;
        toast.success('Categoría agregada');
      }
      setNewCategoryName('');
      setNewCategoryType('');
      setEditingCatId(null);
      fetchCategories();
    } catch (err: any) {
      toast.error('Error al guardar: ' + err.message);
    }
  };

  const handleEditCat = (cat: Category) => {
    setEditingCatId(cat.id);
    setNewCategoryName(cat.name);
    setNewCategoryType(cat.type || '');
  };

  const handleDeleteCat = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta categoría? Solo se podrá si no tiene productos asociados.')) return;
    try {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
      toast.success('Categoría eliminada');
      fetchCategories();
    } catch (err: any) {
      toast.error('Error al eliminar: ' + err.message);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [supabase]);

  const uniqueTypes = useMemo(() => {
    const types = new Set(categories.map((c) => c.type).filter(Boolean));
    return Array.from(types).sort();
  }, [categories]);

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

  const handleBulkToggleActive = async (setActive: boolean) => {
    try {
      await supabase.from('products').update({ active: setActive }).in('id', Array.from(selectedIds));
      toast.success(`${selectedIds.size} productos ${setActive ? 'activados' : 'desactivados'}`);
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
    setFormUnitBase('un');
    setFormUnitDetail('');
    setFormBrand('');
    setIsModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormName(product.name);
    setFormCategoryId(product.category_id);
    setFormStock(product.stock);
    setFormMinStock(product.min_stock);
    
    let base = product.unit;
    let detail = '';
    if (base.includes(' de ')) {
      const parts = base.split(' de ');
      base = parts[0];
      detail = parts[1];
    }
    setFormUnitBase(base);
    setFormUnitDetail(detail || '');
    
    setFormBrand(product.brand || '');
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return toast.error('El nombre es obligatorio');
    if (!formCategoryId) return toast.error('Selecciona una categoría');

    const stockToSave = typeof formStock === 'string' ? (parseInt(formStock, 10) || 0) : formStock;
    const minStockToSave = typeof formMinStock === 'string' ? (parseInt(formMinStock, 10) || 0) : formMinStock;

    const finalUnit = ['rollo', 'caja', 'bolsa', 'tira', 'set'].includes(formUnitBase) && formUnitDetail.trim() 
      ? `${formUnitBase} de ${formUnitDetail.trim()}`
      : formUnitBase;

    setSaving(true);
    try {
      if (editingProduct) {
        // Find stock difference
        const stockDiff = stockToSave - editingProduct.stock;

        // Update
        const { error } = await supabase
          .from('products')
          .update({
            name: formName.trim(),
            brand: formBrand.trim() || null,
            category_id: formCategoryId,
            stock: stockToSave,
            min_stock: minStockToSave,
            unit: finalUnit,
          })
          .eq('id', editingProduct.id);
        if (error) throw error;

        // If stock changed, log movement
        if (stockDiff !== 0) {
           await supabase.from('stock_movements').insert({
              product_id: editingProduct.id,
              type: stockDiff > 0 ? 'entrada' : 'salida',
              quantity: Math.abs(stockDiff),
              reference_type: 'adjustment',
              notes: 'Ajuste manual desde mantenedor de productos',
              created_by: profile?.id
           });
        }
        toast.success('Producto actualizado exitosamente');
      } else {
        // Insert
        const { error } = await supabase
          .from('products')
          .insert({
            name: formName.trim(),
            brand: formBrand.trim() || null,
            category_id: formCategoryId,
            stock: stockToSave,
            min_stock: minStockToSave,
            unit: finalUnit,
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

  const handleExportCSV = () => {
    if (products.length === 0) {
      toast.error('No hay productos para exportar');
      return;
    }

    const dataToExport = products.map(p => ({
      Nombre: p.name,
      Categoria: p.category?.name || '',
      Tipo_Principal: p.category?.type || '',
      Marca: p.brand || '',
      Stock_Actual: p.stock,
      Stock_Minimo: p.min_stock,
      Unidad: p.unit,
      Estado: p.active ? 'Activo' : 'Inactivo'
    }));

    const csvContent = Papa.unparse(dataToExport);
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Inventario_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Inventario exportado exitosamente');
  };

  const processImport = async (file: File) => {
    if (!importCategoryId) {
      toast.error('Debes seleccionar una categoría antes de importar');
      return;
    }
    setImporting(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = results.data as any[];
          if (rows.length === 0) throw new Error('El archivo está vacío');

          const newPreviewData: ImportPreviewRow[] = [];

          for (const row of rows) {
            const name = row.Nombre?.trim();
            
            if (!name) {
              newPreviewData.push({
                originalName: 'Fila sin nombre',
                name: '',
                stock: 0,
                minStock: 0,
                unit: '',
                status: 'error',
                errorMessage: 'Nombre vacío'
              });
              continue;
            }

            const stockRaw = row.Stock_Actual !== undefined ? row.Stock_Actual : row.Stock_Inicial;
            const stock = parseInt(stockRaw) || 0;
            const minStock = parseInt(row.Stock_Minimo) || 0;
            const unit = row.Unidad?.trim()?.toLowerCase() || 'un';

            const existingProd = products.find(p => p.name.toLowerCase() === name.toLowerCase());

            if (existingProd) {
              newPreviewData.push({
                originalName: name,
                name: existingProd.name,
                stock,
                minStock,
                unit,
                status: 'update',
                productId: existingProd.id
              });
            } else {
              newPreviewData.push({
                originalName: name,
                name,
                stock,
                minStock,
                unit,
                status: 'new'
              });
            }
          }

          setPreviewData(newPreviewData);
          setShowPreview(true);

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

  const removePreviewRow = (index: number) => {
    setPreviewData(prev => prev.filter((_, i) => i !== index));
  };

  const updatePreviewRow = (index: number, field: keyof ImportPreviewRow, value: any) => {
    setPreviewData(prev => {
      const newData = [...prev];
      const row = { ...newData[index], [field]: value };
      
      if (field === 'name') {
        const nameStr = value as string;
        if (!nameStr.trim()) {
           row.status = 'error';
           row.errorMessage = 'Nombre vacío';
        } else {
           row.errorMessage = undefined;
           const existingProd = products.find(p => p.name.toLowerCase() === nameStr.toLowerCase());
           if (existingProd) {
              row.status = 'update';
              row.productId = existingProd.id;
           } else {
              row.status = 'new';
              row.productId = undefined;
           }
        }
      }
      
      newData[index] = row;
      return newData;
    });
  };

  const confirmImport = async () => {
    if (previewData.length === 0) return;
    setImporting(true);
    
    let successCount = 0;
    let updateCount = 0;
    let errorCount = 0;

    try {
      for (const row of previewData) {
        if (row.status === 'error') {
           errorCount++;
           continue;
        }

        if (row.status === 'update' && row.productId) {
          const { error } = await supabase
            .from('products')
            .update({
              category_id: importCategoryId,
              stock: row.stock,
              min_stock: row.minStock,
              unit: row.unit,
            })
            .eq('id', row.productId);
          
          if (error) errorCount++;
          else updateCount++;
        } else if (row.status === 'new') {
          const { error } = await supabase
            .from('products')
            .insert({
              name: row.name,
              category_id: importCategoryId,
              stock: row.stock,
              min_stock: row.minStock,
              unit: row.unit,
            });
            
          if (error) errorCount++;
          else successCount++;
        }
      }

      toast.success(`Importación finalizada. Creados: ${successCount}, Actualizados: ${updateCount}, Errores: ${errorCount}`);
      setIsImportModalOpen(false);
      setShowPreview(false);
      setPreviewData([]);
      await cleanupCategories();
      fetchProducts();
      fetchCategories();
    } catch (e: any) {
       toast.error('Error durante la importación: ' + e.message);
    } finally {
       setImporting(false);
    }
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
    if (!file) return;
    if (!importCategoryId) {
      toast.error('Selecciona una categoría primero');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    processImport(file);
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
          <Button variant="outline" onClick={() => setIsCategoryModalOpen(true)}>
            <Tags className="w-4 h-4 mr-2" />
            Categorías
          </Button>
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
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

      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between bg-card p-2 rounded-xl border border-border/50 shadow-sm">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto overflow-x-auto pb-1 md:pb-0">
          <TabsList className="h-9 bg-background">
            <TabsTrigger value="all" className="rounded-md data-[state=active]:bg-muted">Todos</TabsTrigger>
            {uniqueTypes.map((type) => (
              <TabsTrigger key={type} value={type} className="capitalize rounded-md data-[state=active]:bg-muted">
                {type}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex gap-2 w-full sm:w-auto shrink-0">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar producto..."
              className="pl-9 h-10 bg-background border-none shadow-none focus-visible:ring-1"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={sortBy} onValueChange={(val) => setSortBy(val || 'name')}>
            <SelectTrigger className="w-[140px] h-10 hidden sm:flex bg-background border-none shadow-none">
              <SelectValue placeholder="Ordenar por...">
                {sortBy === 'name_asc' && <div className="flex items-center"><ArrowDownAZ className="w-4 h-4 mr-2" /> A - Z</div>}
                {sortBy === 'name_desc' && <div className="flex items-center"><ArrowUpAZ className="w-4 h-4 mr-2" /> Z - A</div>}
                {sortBy === 'stock_asc' && <div className="flex items-center"><ArrowDown01 className="w-4 h-4 mr-2" /> Menor Stock</div>}
                {sortBy === 'stock_desc' && <div className="flex items-center"><ArrowUp10 className="w-4 h-4 mr-2" /> Mayor Stock</div>}
                {sortBy === 'status' && 'Estado'}
              </SelectValue>
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
      </div>

      <div>
        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-xl p-3 mb-4 animate-in fade-in-50">
            <span className="text-sm font-medium">{selectedIds.size} producto(s) seleccionado(s)</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())}>
                Deseleccionar
              </Button>
              {Array.from(selectedIds).some(id => products.find(p => p.id === id)?.active) ? (
                <Button size="sm" variant="outline" className="text-amber-400 border-amber-500/30 hover:bg-amber-500/10" onClick={() => handleBulkToggleActive(false)}>
                  Desactivar
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10" onClick={() => handleBulkToggleActive(true)}>
                  Activar
                </Button>
              )}
              <Button size="sm" variant="destructive" onClick={handleBulkDelete}>
                <Trash2 className="w-4 h-4 mr-1" /> Eliminar
              </Button>
            </div>
          </div>
        )}
        <div className="rounded-xl border border-border/50 overflow-hidden bg-card shadow-sm">
          <Table>
            <TableHeader className="bg-muted/50 border-b border-border/50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12">
                  <Checkbox
                    checked={filteredProducts.length > 0 && selectedIds.size === filteredProducts.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="font-semibold text-foreground">Producto</TableHead>
                <TableHead className="hidden sm:table-cell font-semibold text-foreground">Categoría</TableHead>
                <TableHead className="text-right font-semibold text-foreground">Stock</TableHead>
                <TableHead className="hidden md:table-cell text-right font-semibold text-foreground">Mínimo</TableHead>
                <TableHead className="hidden lg:table-cell font-semibold text-foreground">Estado</TableHead>
                <TableHead className="text-right font-semibold text-foreground">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    No se encontraron productos
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map(product => (
                  <TableRow 
                    key={product.id}
                    className={`hover:bg-muted/20 transition-colors border-border/50 ${selectedIds.has(product.id) ? 'bg-primary/5' : ''}`}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(product.id)}
                        onCheckedChange={() => toggleSelect(product.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-muted-foreground" />
                        <div>
                          {product.name}
                          {product.brand && (
                            <div className="text-xs text-muted-foreground font-normal">{product.brand}</div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                      {product.category?.name}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`font-bold text-base ${(product.stock <= product.min_stock && product.min_stock > 0) ? 'text-destructive' : 'text-foreground'}`}>
                        {product.stock}
                      </span> 
                      <span className="text-xs text-muted-foreground ml-1">{product.unit}</span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right text-muted-foreground text-sm">
                      {product.min_stock}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {product.active ? (
                        <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Activo
                        </span>
                      ) : (
                        <Badge variant="secondary" className="bg-muted text-muted-foreground font-normal text-xs px-2 rounded-sm border-transparent">
                          Inactivo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1 opacity-60 hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => openEditModal(product)}
                          title="Editar"
                        >
                          <FileEdit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className={`h-8 w-8 hover:bg-muted ${product.active ? 'text-muted-foreground hover:text-warning' : 'text-muted-foreground hover:text-success'}`}
                          onClick={() => toggleProductStatus(product.id, product.active)}
                          title={product.active ? 'Desactivar' : 'Activar'}
                        >
                          {product.active ? <PackageX className="w-4 h-4" /> : <PackageCheck className="w-4 h-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
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
      </div>

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
                  <SelectValue placeholder="Seleccionar categoría...">
                    {categories.find(c => c.id === formCategoryId) ? `${categories.find(c => c.id === formCategoryId)?.name} (${categories.find(c => c.id === formCategoryId)?.type})` : null}
                  </SelectValue>
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

            <div className="space-y-2">
              <Label>Marca</Label>
              <Input
                placeholder="Ej. 3M, Bosch, Stanley..."
                value={formBrand}
                onChange={(e) => setFormBrand(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{editingProduct ? 'Ajustar Stock' : 'Stock Inicial'}</Label>
                <Input
                  type="number"
                  min="0"
                  value={formStock}
                  onChange={(e) => setFormStock(e.target.value === '' ? '' : (parseInt(e.target.value, 10) || 0))}
                />
              </div>
              <div className="space-y-2">
                <Label>Stock Mínimo</Label>
                <Input
                  type="number"
                  min="0"
                  value={formMinStock}
                  onChange={(e) => setFormMinStock(e.target.value === '' ? '' : (parseInt(e.target.value, 10) || 0))}
                />
              </div>
              <div className="space-y-2">
                <Label>Unidad</Label>
                <div className="flex gap-2">
                  <Select value={formUnitBase} onValueChange={(val) => setFormUnitBase(val || 'un')}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="un">un (Unidad)</SelectItem>
                      <SelectItem value="par">par (Par)</SelectItem>
                      <SelectItem value="mt">mt (Metro)</SelectItem>
                      <SelectItem value="kg">kg (Kilo)</SelectItem>
                      <SelectItem value="lt">lt (Litro)</SelectItem>
                      <SelectItem value="rollo">rollo</SelectItem>
                      <SelectItem value="caja">caja</SelectItem>
                      <SelectItem value="bolsa">bolsa</SelectItem>
                      <SelectItem value="tira">tira</SelectItem>
                      <SelectItem value="set">set</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {['rollo', 'caja', 'bolsa', 'tira', 'set'].includes(formUnitBase) && (
                    <Input 
                      placeholder="Cant. (Ej: 100)"
                      value={formUnitDetail}
                      onChange={e => setFormUnitDetail(e.target.value)}
                      className="w-32"
                    />
                  )}
                </div>
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
      <Dialog open={isImportModalOpen} onOpenChange={(open) => {
        setIsImportModalOpen(open);
        if (!open) {
          setShowPreview(false);
          setPreviewData([]);
        }
      }}>
        <DialogContent className={showPreview ? "max-w-[95vw] sm:max-w-4xl max-h-[90vh]" : "max-w-md"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" /> 
              {showPreview ? 'Vista Previa de Importación' : 'Importación Masiva'}
            </DialogTitle>
          </DialogHeader>

          {!showPreview ? (
            <div className="space-y-6 py-4">
              <div className="bg-muted/50 p-4 rounded-lg border border-border text-sm space-y-3">
                <p>Para asegurar una importación exitosa, sigue estos pasos:</p>
                <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
                  <li>Selecciona la categoría destino.</li>
                  <li>Descarga la plantilla CSV.</li>
                  <li>Llénala con tus productos (en Excel, usa "Guardar como CSV").</li>
                  <li>Sube el archivo aquí.</li>
                </ol>
                <p className="text-xs text-muted-foreground pt-2 border-t border-border/50">
                  Nota: Al subir, verás una previsualización para confirmar antes de guardar en el sistema.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Categoría Destino</Label>
                <Select value={importCategoryId} onValueChange={(val) => setImportCategoryId(val || '')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una categoría...">
                      {categories.find(c => c.id === importCategoryId)?.name || 'Selecciona una categoría...'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                    disabled={importing || !importCategoryId}
                  />
                </div>
                {!importCategoryId && (
                  <p className="text-xs text-amber-500">⚠ Selecciona una categoría primero</p>
                )}
                {importing && (
                  <div className="flex items-center gap-2 text-sm text-primary mt-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Procesando importación...
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="flex flex-wrap gap-4 mb-2">
                <Badge variant="outline" className="bg-success/10 text-success border-success/20 py-1">
                  {previewData.filter(r => r.status === 'new').length} Nuevos
                </Badge>
                <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 py-1">
                  {previewData.filter(r => r.status === 'update').length} A Actualizar
                </Badge>
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 py-1">
                  {previewData.filter(r => r.status === 'error').length} Errores
                </Badge>
              </div>
              
              <div className="border rounded-md overflow-hidden flex-1 min-h-0 relative">
                <div className="max-h-[60vh] overflow-auto">
                  <Table>
                    <TableHeader className="bg-muted/50 sticky top-0 z-10 shadow-sm">
                      <TableRow>
                        <TableHead className="w-[100px]">Estado</TableHead>
                        <TableHead>Producto</TableHead>
                        <TableHead className="w-[100px] text-right">Stock</TableHead>
                        <TableHead className="w-[100px] text-right">Mín.</TableHead>
                        <TableHead className="w-[100px]">Und.</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.map((row, i) => (
                        <TableRow key={i} className={row.status === 'error' ? 'bg-destructive/5' : ''}>
                          <TableCell>
                             {row.status === 'new' && <Badge className="bg-success hover:bg-success/80">Crear</Badge>}
                             {row.status === 'update' && <Badge className="bg-warning hover:bg-warning/80 text-warning-foreground">Actualizar</Badge>}
                             {row.status === 'error' && <Badge variant="destructive">Error</Badge>}
                          </TableCell>
                          <TableCell className="p-1">
                             <Input 
                               className="h-8 border-transparent hover:border-border focus:border-primary px-2 shadow-none" 
                               value={row.name} 
                               onChange={(e) => updatePreviewRow(i, 'name', e.target.value)}
                               placeholder="Nombre del producto"
                             />
                             {row.errorMessage && <p className="text-xs text-destructive px-2 mt-0.5">{row.errorMessage}</p>}
                          </TableCell>
                          <TableCell className="p-1">
                            <Input 
                               type="number"
                               min="0"
                               className="h-8 text-right font-bold border-transparent hover:border-border focus:border-primary px-2 shadow-none" 
                               value={row.stock} 
                               onChange={(e) => updatePreviewRow(i, 'stock', parseInt(e.target.value) || 0)}
                             />
                          </TableCell>
                          <TableCell className="p-1">
                            <Input 
                               type="number"
                               min="0"
                               className="h-8 text-right text-muted-foreground border-transparent hover:border-border focus:border-primary px-2 shadow-none" 
                               value={row.minStock} 
                               onChange={(e) => updatePreviewRow(i, 'minStock', parseInt(e.target.value) || 0)}
                             />
                          </TableCell>
                          <TableCell className="p-1">
                            <Input 
                               className="h-8 text-muted-foreground border-transparent hover:border-border focus:border-primary px-2 shadow-none" 
                               value={row.unit} 
                               onChange={(e) => updatePreviewRow(i, 'unit', e.target.value)}
                             />
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => removePreviewRow(i)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {previewData.length === 0 && (
                        <TableRow><TableCell colSpan={6} className="text-center py-4">No hay datos que procesar</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
              
              <DialogFooter className="mt-4 flex flex-col-reverse sm:flex-row gap-2 sm:justify-between w-full">
                 <Button variant="outline" onClick={() => { setShowPreview(false); setPreviewData([]); }}>
                   Descartar y Volver
                 </Button>
                 <Button onClick={confirmImport} disabled={importing || previewData.length === 0}>
                   {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                   Confirmar Importación
                 </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Categories Modal */}
      <Dialog open={isCategoryModalOpen} onOpenChange={setIsCategoryModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tags className="w-5 h-5 text-primary" /> Categorías
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="space-y-2 flex-1">
                  <Label>Nueva Categoría</Label>
                  <Input
                    placeholder="Ej. Pinturas"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                  />
                </div>
                <div className="space-y-2 w-48">
                  <Label>Tipo (Familia)</Label>
                  <Input 
                    list="category-types" 
                    placeholder="Ej. Material, Pinturas..."
                    value={newCategoryType}
                    onChange={(e) => setNewCategoryType(e.target.value)}
                  />
                  <datalist id="category-types">
                    {uniqueTypes.map(t => <option key={t} value={t} />)}
                  </datalist>
                </div>
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={handleAddCategory}>
                  {editingCatId ? 'Guardar Cambios' : 'Agregar Categoría'}
                </Button>
                {editingCatId && (
                  <Button variant="outline" onClick={() => { setEditingCatId(null); setNewCategoryName(''); setNewCategoryType(''); }}>
                    Cancelar
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-4 border rounded-md overflow-hidden max-h-60 overflow-y-auto">
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0">
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="w-[100px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        No hay categorías registradas
                      </TableCell>
                    </TableRow>
                  ) : (
                    categories.map(cat => (
                      <TableRow key={cat.id}>
                        <TableCell className="font-medium">{cat.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm capitalize">{cat.type}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-500/10" onClick={() => handleEditCat(cat)}>
                              <FileEdit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteCat(cat.id)}>
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
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
