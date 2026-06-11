'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Loader2, FileText, FileX2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import type { Vale } from '@/lib/types';

export default function MisValesPage() {
  const { profile } = useAuth();
  const supabase = createClient();
  const [vales, setVales] = useState<Vale[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVales = async () => {
      if (!profile) return;
      
      let query = supabase
        .from('vales')
        .select(`
          *,
          worker:workers(*),
          creator:profiles!vales_created_by_fkey(full_name),
          items:vale_items(*, product:products(*))
        `)
        .order('created_at', { ascending: false });

      if (profile.role !== 'admin') {
        query = query.eq('created_by', profile.id);
      }

      const { data } = await query;

      setVales(
        (data || []).map((v: Record<string, unknown>) => ({
          ...v,
          worker: Array.isArray(v.worker) ? v.worker[0] : v.worker,
          creator: Array.isArray(v.creator) ? v.creator[0] : v.creator,
        })) as Vale[]
      );
      setLoading(false);
    };

    fetchVales();

    const channelFilter = profile?.role === 'admin' 
      ? undefined 
      : `created_by=eq.${profile?.id}`;

    const channel = supabase
      .channel('mis-vales')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'vales', 
          ...(channelFilter ? { filter: channelFilter } : {}) 
        },
        () => fetchVales()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, profile]);

  const filteredVales = vales.filter((v) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      v.vale_number.toString().includes(s) ||
      (v.worker?.name || '').toLowerCase().includes(s)
    );
  });

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
          <h2 className="text-xl font-bold">
            {profile?.role === 'admin' ? 'Todos los Vales' : 'Mis Vales Emitidos'}
          </h2>
          <p className="text-muted-foreground text-sm">
            {profile?.role === 'admin' ? 'Auditoría y registro de todos los vales emitidos.' : 'Historial de vales creados por ti.'}
          </p>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por vale o nombre..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {filteredVales.length === 0 ? (
        <Card className="card-glow border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <FileX2 className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">No se encontraron vales</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              {search ? 'Sin resultados para la búsqueda' : 'Aún no has creado ningún vale.'}
            </p>
            {!search && (
              <Link href="/dashboard/vales/nuevo" className="text-primary hover:underline font-medium text-sm">
                + Crear el primer vale
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredVales.map((vale) => (
            <Card key={vale.id} className="card-glow border-border/50">
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mt-1 shrink-0">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold font-mono">#{vale.vale_number}</span>
                      <Badge
                        variant="outline"
                        className={
                          vale.status === 'pendiente'
                            ? 'bg-warning/15 text-warning border-warning/30'
                            : 'bg-success/15 text-success border-success/30'
                        }
                      >
                        {vale.status}
                      </Badge>
                      <Badge variant="secondary" className="uppercase text-[10px]">
                        {vale.type.replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="text-sm">
                      <span className="text-muted-foreground">Trabajador:</span> {vale.worker?.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(vale.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                      {' · '}
                      {vale.creator?.full_name ? `Por: ${vale.creator.full_name} · ` : ''}
                      {vale.items?.length || 0} ítems
                    </p>
                  </div>
                </div>

                <div className="text-left sm:text-right bg-muted/20 p-3 sm:p-0 sm:bg-transparent rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">
                    Ítems solicitados
                  </p>
                  <div className="flex flex-col sm:items-end gap-1">
                    {(vale.items || []).slice(0, 2).map((item) => (
                      <span key={item.id} className="text-xs font-medium truncate max-w-[200px] sm:max-w-none">
                        x{item.quantity} {item.product?.name}
                      </span>
                    ))}
                    {(vale.items || []).length > 2 && (
                      <span className="text-[10px] text-muted-foreground">
                        + {(vale.items || []).length - 2} más
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
