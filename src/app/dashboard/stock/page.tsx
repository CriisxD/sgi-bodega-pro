'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Search, Loader2, Package, AlertTriangle, History,
  ArrowDownRight, ArrowUpRight, LayoutGrid, List,
  ArrowUpDown, SlidersHorizontal, Plus, Minus, Save,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import type { Product, Category } from '@/lib/types';

type SortOption = 'critical' | 'stock_asc' | 'alpha' | 'category';
type ViewMode = 'cards' | 'table';

const sortLabels: Record<SortOption, string> = {
  critical: 'Críticos primero',
  stock_asc: 'Menor stock',
  alpha: 'Alfabético',
  category: 'Por categoría',
};

export default function StockPage() {
  const supabase = createClient();
  const { profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // View & Sort
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [sortBy, setSortBy] = useState<SortOption>('critical');
  const [onlyCritical, setOnlyCritical] = useState(false);

  // History Modal
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [movements, setMovements] = useState<any[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);

  // Adjust Stock Modal
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [adjustType, setAdjustType] = useState<'entrada' | 'salida'>('entrada');
  const [adjustQty, setAdjustQty] = useState<number | ''>(1);
  const [adjustNotes, setAdjustNotes] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const { data: cats } = await supabase.from('categories').select('*').order('name');
      setCategories(cats || []);

      const { data: prods } = await supabase
        .from('products')
        .select(`*, category:categories(*)`)
        .eq('active', true)
        .order('name');

      setProducts(prods as Product[] || []);
      setLoading(false);
    };

    fetchData();

    const channel = supabase
      .channel('stock-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        () => {
          supabase
            .from('products')
            .select(`*, category:categories(*)`)
            .eq('active', true)
            .order('name')
            .then(({ data }) => setProducts(data as Product[] || []));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  // Fetch movements when a product is selected
  useEffect(() => {
    if (!selectedProduct) {
      setMovements([]);
      return;
    }
    const fetchMovs = async () => {
      setLoadingMovements(true);
      const { data } = await supabase
        .from('stock_movements')
        .select(`
          *,
          profile:profiles!stock_movements_created_by_fkey(full_name)
        `)
        .eq('product_id', selectedProduct.id)
        .order('created_at', { ascending: false });
      setMovements(data || []);
      setLoadingMovements(false);
    };
    fetchMovs();
  }, [selectedProduct, supabase]);

  // Filter + Sort
  const filteredProducts = useMemo(() => {
    let result = products.filter((p) => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
      const matchCategory = selectedCategory === 'all' || p.category_id === selectedCategory;
      const matchCritical = onlyCritical ? p.stock <= p.min_stock : true;
      return matchSearch && matchCategory && matchCritical;
    });

    result.sort((a, b) => {
      switch (sortBy) {
        case 'critical': {
          const aCrit = a.stock <= a.min_stock ? 0 : 1;
          const bCrit = b.stock <= b.min_stock ? 0 : 1;
          if (aCrit !== bCrit) return aCrit - bCrit;
          return a.stock - b.stock;
        }
        case 'stock_asc':
          return a.stock - b.stock;
        case 'alpha':
          return a.name.localeCompare(b.name);
        case 'category': {
          const catA = a.category?.name || '';
          const catB = b.category?.name || '';
          const cmp = catA.localeCompare(catB);
          return cmp !== 0 ? cmp : a.name.localeCompare(b.name);
        }
        default:
          return 0;
      }
    });

    return result;
  }, [products, search, selectedCategory, onlyCritical, sortBy]);

  const lowStockCount = products.filter((p) => p.stock <= p.min_stock).length;

  // Adjust Stock Handler
  const handleAdjustStock = async () => {
    if (!adjustProduct || !profile || adjustQty === '' || adjustQty <= 0) return;
    setAdjusting(true);
    try {
      if (adjustType === 'entrada') {
        const { error } = await supabase.rpc('increase_stock', {
          p_product_id: adjustProduct.id,
          p_quantity: adjustQty,
        });
        if (error) {
          await supabase
            .from('products')
            .update({ stock: adjustProduct.stock + adjustQty })
            .eq('id', adjustProduct.id);
        }
      } else {
        if (adjustQty > adjustProduct.stock) {
          toast.error('No puedes sacar más de lo que hay en stock');
          setAdjusting(false);
          return;
        }
        const { error } = await supabase.rpc('decrease_stock', {
          p_product_id: adjustProduct.id,
          p_quantity: adjustQty,
        });
        if (error) {
          await supabase
            .from('products')
            .update({ stock: adjustProduct.stock - adjustQty })
            .eq('id', adjustProduct.id);
        }
      }

      await supabase.from('stock_movements').insert({
        product_id: adjustProduct.id,
        type: adjustType,
        quantity: adjustQty,
        reference_type: 'ajuste_manual',
        notes: adjustNotes || `Ajuste manual de stock`,
        created_by: profile.id,
      });

      toast.success(`Stock ${adjustType === 'entrada' ? 'sumado' : 'restado'} exitosamente`);
      setAdjustProduct(null);
      setAdjustQty(1);
      setAdjustNotes('');
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    } finally {
      setAdjusting(false);
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
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Inventario de Stock</h2>
            <p className="text-muted-foreground text-sm">
              {products.length} productos registrados ({lowStockCount} con stock bajo)
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* View Toggle */}
            <div className="flex border rounded-lg overflow-hidden">
              <Button
                variant={viewMode === 'cards' ? 'default' : 'ghost'}
                size="icon"
                className="h-9 w-9 rounded-none"
                onClick={() => setViewMode('cards')}
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="icon"
                className="h-9 w-9 rounded-none"
                onClick={() => setViewMode('table')}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>

            {/* Sort */}
            <Select value={sortBy} onValueChange={(val) => setSortBy((val || 'critical') as SortOption)}>
              <SelectTrigger className="w-[170px] h-9">
                <ArrowUpDown className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                <SelectValue>
                  {sortLabels[sortBy]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(sortLabels) as [SortOption, string][]).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar producto..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Critical Only Toggle */}
          <Button
            variant={onlyCritical ? 'destructive' : 'outline'}
            size="sm"
            onClick={() => setOnlyCritical(!onlyCritical)}
            className="whitespace-nowrap"
          >
            <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
            Solo Críticos ({lowStockCount})
          </Button>

          <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 hide-scrollbar">
            <Button
              variant={selectedCategory === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory('all')}
              className="whitespace-nowrap"
            >
              Todos
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(cat.id)}
                className="whitespace-nowrap"
              >
                {cat.name}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* === CARDS VIEW === */}
      {viewMode === 'cards' && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProducts.map((product) => {
            const isLowStock = product.stock <= product.min_stock;
            return (
              <Card
                key={product.id}
                className={`card-glow overflow-hidden transition-all hover:border-primary/50 ${
                  isLowStock ? 'bg-destructive/5 border-destructive/20' : 'bg-card border-border/50'
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex bg-muted/50 p-2 rounded w-10 h-10 items-center justify-center shrink-0">
                      <Package className="w-5 h-5 text-muted-foreground" />
                    </div>
                    {isLowStock && (
                      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Crítico
                      </Badge>
                    )}
                  </div>

                  <h3 className="font-semibold text-sm line-clamp-2 leading-tight min-h-[2.5rem]">
                    {product.name}
                  </h3>

                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">
                        {product.category?.name || 'Sin categoría'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Mínimo: {product.min_stock} {product.unit}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`text-2xl font-bold tracking-tight ${isLowStock ? 'text-destructive' : 'text-primary'}`}>
                        {product.stock}
                      </span>
                      <span className="text-xs text-muted-foreground ml-1">{product.unit}</span>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="mt-3 pt-3 border-t border-border/30 flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 h-8 text-xs"
                      onClick={(e) => { e.stopPropagation(); setSelectedProduct(product); }}
                    >
                      <History className="w-3.5 h-3.5 mr-1" /> Historial
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 h-8 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAdjustProduct(product);
                        setAdjustType('entrada');
                        setAdjustQty(1);
                        setAdjustNotes('');
                      }}
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5 mr-1" /> Ajustar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {filteredProducts.length === 0 && (
            <div className="col-span-full py-12 text-center text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No se encontraron productos{search ? ' que coincidan con la búsqueda' : ''}.</p>
            </div>
          )}
        </div>
      )}

      {/* === TABLE VIEW === */}
      {viewMode === 'table' && (
        <div className="border rounded-xl overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Estado</th>
                  <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Producto</th>
                  <th className="text-left py-3 px-4 font-semibold text-muted-foreground hidden sm:table-cell">Categoría</th>
                  <th className="text-center py-3 px-4 font-semibold text-muted-foreground">Stock</th>
                  <th className="text-center py-3 px-4 font-semibold text-muted-foreground hidden sm:table-cell">Mínimo</th>
                  <th className="text-right py-3 px-4 font-semibold text-muted-foreground">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => {
                  const isLowStock = product.stock <= product.min_stock;
                  return (
                    <tr key={product.id} className={`border-b last:border-0 transition-colors hover:bg-muted/20 ${isLowStock ? 'bg-destructive/5' : ''}`}>
                      <td className="py-2.5 px-4">
                        {isLowStock ? (
                          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-[10px]">
                            <AlertTriangle className="w-3 h-3 mr-1" /> Crítico
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-[10px]">OK</Badge>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-medium">{product.name}</td>
                      <td className="py-2.5 px-4 text-muted-foreground hidden sm:table-cell">{product.category?.name || '—'}</td>
                      <td className="py-2.5 px-4 text-center">
                        <span className={`font-bold text-lg ${isLowStock ? 'text-destructive' : 'text-primary'}`}>
                          {product.stock}
                        </span>
                        <span className="text-xs text-muted-foreground ml-1">{product.unit}</span>
                      </td>
                      <td className="py-2.5 px-4 text-center text-muted-foreground hidden sm:table-cell">{product.min_stock}</td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedProduct(product)}>
                            <History className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setAdjustProduct(product);
                              setAdjustType('entrada');
                              setAdjustQty(1);
                              setAdjustNotes('');
                            }}
                          >
                            <SlidersHorizontal className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredProducts.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No se encontraron productos.</p>
            </div>
          )}
        </div>
      )}

      {/* === HISTORY MODAL === */}
      <Dialog open={!!selectedProduct} onOpenChange={(open) => !open && setSelectedProduct(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              Historial de Movimientos
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Producto: <span className="font-bold text-foreground">{selectedProduct?.name}</span>
              <span className="ml-3">Stock actual: <span className="font-bold text-primary">{selectedProduct?.stock}</span></span>
            </p>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-2 mt-4 space-y-3">
            {loadingMovements ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : movements.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                No hay movimientos registrados para este producto.
              </div>
            ) : (
              movements.map((mov) => {
                const isEntry = mov.type === 'entrada';
                return (
                  <div key={mov.id} className="flex gap-4 p-3 rounded-lg border bg-card/50">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isEntry ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'}`}>
                      {isEntry ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <p className="font-semibold text-sm">
                          {isEntry ? 'Ingreso de Stock' : 'Salida de Stock'}
                        </p>
                        <span className={`font-bold ${isEntry ? 'text-success' : 'text-destructive'}`}>
                          {isEntry ? '+' : '-'}{mov.quantity}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(mov.created_at), "d MMMM yyyy, HH:mm", { locale: es })}
                      </p>
                      <div className="mt-2 text-xs flex flex-wrap gap-x-4 gap-y-1">
                        <span className="font-medium">Por: {mov.profile?.full_name || 'Sistema'}</span>
                        <span className="text-muted-foreground">Razón: <span className="uppercase">{mov.reference_type}</span></span>
                        {mov.notes && <span className="text-muted-foreground">Nota: {mov.notes}</span>}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* === ADJUST STOCK MODAL === */}
      <Dialog open={!!adjustProduct} onOpenChange={(open) => !open && setAdjustProduct(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-primary" />
              Ajustar Stock
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {adjustProduct?.name}
              <span className="ml-2 font-bold text-foreground">({adjustProduct?.stock} {adjustProduct?.unit} actual)</span>
            </p>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Type Toggle */}
            <div className="flex border rounded-lg overflow-hidden">
              <Button
                variant={adjustType === 'entrada' ? 'default' : 'ghost'}
                className={`flex-1 rounded-none ${adjustType === 'entrada' ? 'bg-success hover:bg-success/90 text-white' : ''}`}
                onClick={() => setAdjustType('entrada')}
              >
                <Plus className="w-4 h-4 mr-2" /> Sumar
              </Button>
              <Button
                variant={adjustType === 'salida' ? 'default' : 'ghost'}
                className={`flex-1 rounded-none ${adjustType === 'salida' ? 'bg-destructive hover:bg-destructive/90 text-white' : ''}`}
                onClick={() => setAdjustType('salida')}
              >
                <Minus className="w-4 h-4 mr-2" /> Restar
              </Button>
            </div>

            {/* Quantity */}
            <div className="space-y-2">
              <Label>Cantidad</Label>
              <Input
                type="number"
                min={1}
                max={adjustType === 'salida' ? adjustProduct?.stock : undefined}
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                className="text-center text-xl font-bold h-14"
              />
            </div>

            {/* Preview */}
            <div className="bg-muted/30 p-3 rounded-lg border text-center">
              <p className="text-xs text-muted-foreground mb-1">Nuevo stock será:</p>
              <p className="text-2xl font-bold text-primary">
                {adjustType === 'entrada'
                  ? (adjustProduct?.stock || 0) + (adjustQty || 0)
                  : Math.max(0, (adjustProduct?.stock || 0) - (adjustQty || 0))
                } {adjustProduct?.unit}
              </p>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Razón del ajuste (opcional)</Label>
              <Textarea
                value={adjustNotes}
                onChange={(e) => setAdjustNotes(e.target.value)}
                placeholder="Ej: Conteo físico, merma, préstamo a otra obra..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setAdjustProduct(null)}>Cancelar</Button>
            <Button
              onClick={handleAdjustStock}
              disabled={adjusting || adjustQty === '' || adjustQty <= 0}
              className={adjustType === 'entrada' ? 'bg-success hover:bg-success/90' : 'bg-destructive hover:bg-destructive/90'}
            >
              {adjusting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Guardando...</>
              ) : (
                <><Save className="w-4 h-4 mr-2" /> Confirmar Ajuste</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
