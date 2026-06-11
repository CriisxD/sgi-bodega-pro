'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2, Package, AlertTriangle, Filter } from 'lucide-react';
import type { Product, Category } from '@/lib/types';

export default function StockPage() {
  const supabase = createClient();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);

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
              className={`card-glow overflow-hidden transition-all hover:border-primary/30 ${
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
    </div>
  );
}
