'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2, Package, AlertTriangle, Filter, History, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Product, Category } from '@/lib/types';

export default function StockPage() {
  const supabase = createClient();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [movements, setMovements] = useState<any[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch categories
      const { data: cats } = await supabase.from('categories').select('*').order('name');
      setCategories(cats || []);

      // Fetch products
      const { data: prods } = await supabase
        .from('products')
        .select(`*, category:categories(*)`)
        .eq('active', true)
        .order('name');
      
      setProducts(prods as Product[] || []);
      setLoading(false);
    };

    fetchData();

    // Setup realtime subscription for stock changes
    const channel = supabase
      .channel('stock-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        () => {
          // Re-fetch products when stock changes
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

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
      const matchCategory = selectedCategory === 'all' || p.category_id === selectedCategory;
      return matchSearch && matchCategory;
    });
  }, [products, search, selectedCategory]);

  const lowStockCount = products.filter((p) => p.stock <= p.min_stock).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Inventario de Stock</h2>
          <p className="text-muted-foreground text-sm">
            {products.length} productos registrados ({lowStockCount} con stock bajo)
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar producto..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredProducts.map((product) => {
          const isLowStock = product.stock <= product.min_stock;
          return (
            <Card
              key={product.id}
              onClick={() => setSelectedProduct(product)}
              className={`card-glow overflow-hidden transition-all hover:border-primary/50 cursor-pointer ${
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
                      Critico
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

      <Dialog open={!!selectedProduct} onOpenChange={(open) => !open && setSelectedProduct(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-primary" /> 
              Historial de Movimientos
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Producto: <span className="font-bold text-foreground">{selectedProduct?.name}</span>
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
                        {mov.notes && <span className="text-muted-foreground col-span-2">Nota: {mov.notes}</span>}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
