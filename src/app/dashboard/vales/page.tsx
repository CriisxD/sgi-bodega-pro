'use client';

import { useState, useEffect } from 'react';
import { usePersistentState } from '@/hooks/use-persistent-state';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  FileText, 
  FileX2, 
  LayoutGrid, 
  List, 
  ArrowDownWideNarrow, 
  ArrowUpNarrowWide,
  Pencil,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import type { Vale } from '@/lib/types';

type ViewMode = 'cards' | 'table';
type StatusFilter = 'all' | 'pendiente' | 'procesado';
type TypeFilter = 'all' | 'material' | 'epp' | 'cargo_personal' | 'uso_diario';
type SortBy = 'date_desc' | 'date_asc' | 'status';

export default function MisValesPage() {
  const { profile } = useAuth();
  const supabase = createClient();
  const [vales, setVales] = useState<Vale[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDeleteVale = async (vale: Vale) => {
    if (!confirm('¿Seguro que deseas eliminar este vale? Se revertirá el stock si ya fue procesado y se borrará su historial.')) return;
    setDeletingId(vale.id);
    try {
      if (vale.status === 'procesado') {
        for (const item of vale.items || []) {
           if (item.quantity_delivered && item.quantity_delivered > 0) {
              const { error } = await supabase.rpc('increase_stock', { p_product_id: item.product_id, p_quantity: item.quantity_delivered });
              if (error) {
                 const { data: p } = await supabase.from('products').select('stock').eq('id', item.product_id).single();
                 if (p) await supabase.from('products').update({ stock: p.stock + item.quantity_delivered }).eq('id', item.product_id);
              }
           }
        }
        await supabase.from('stock_movements').delete().eq('reference_id', vale.id);
        await supabase.from('epp_records').delete().eq('vale_id', vale.id);
        await supabase.from('tool_assignments').delete().eq('vale_id', vale.id);
      }
      await supabase.from('vale_items').delete().eq('vale_id', vale.id);
      await supabase.from('vales').delete().eq('id', vale.id);
      toast.success('Vale eliminado');
      setVales(prev => prev.filter(v => v.id !== vale.id));
    } catch (error: any) {
      toast.error('Error al eliminar: ' + error.message);
    } finally {
      setDeletingId(null);
    }
  };

  // Filters & View State
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = usePersistentState<ViewMode>('vales-viewMode', 'cards');
  const [statusFilter, setStatusFilter] = usePersistentState<StatusFilter>('vales-statusFilter', 'all');
  const [typeFilter, setTypeFilter] = usePersistentState<TypeFilter>('vales-typeFilter', 'all');
  const [sortBy, setSortBy] = usePersistentState<SortBy>('vales-sortBy', 'date_desc');

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

      if (profile.role !== 'admin' && profile.role !== 'bodeguero') {
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

    const channelFilter = (profile?.role === 'admin' || profile?.role === 'bodeguero')
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

  const filteredVales = vales
    .filter((v) => {
      // Search filter
      if (search) {
        const s = search.toLowerCase();
        const matchesSearch = 
          v.vale_number.toString().includes(s) ||
          (v.worker?.name || '').toLowerCase().includes(s);
        if (!matchesSearch) return false;
      }
      // Status filter
      if (statusFilter !== 'all' && v.status !== statusFilter) return false;
      // Type filter
      if (typeFilter !== 'all' && v.type !== typeFilter) return false;
      
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'date_desc') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === 'date_asc') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortBy === 'status') {
        if (a.status === 'pendiente' && b.status !== 'pendiente') return -1;
        if (b.status === 'pendiente' && a.status !== 'pendiente') return 1;
        // fallback to date desc
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return 0;
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
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">
              {profile?.role === 'admin' || profile?.role === 'bodeguero' ? 'Todos los Vales' : 'Mis Vales Emitidos'}
            </h2>
            <p className="text-muted-foreground text-sm">
              {profile?.role === 'admin' || profile?.role === 'bodeguero' ? 'Auditoría y registro de todos los vales.' : 'Historial de vales creados por ti.'}
            </p>
          </div>
        </div>

        <div className="flex flex-col xl:flex-row gap-3 xl:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-1">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por vale o trabajador..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Tipo de vale">
                  {typeFilter === 'all' && 'Todos los tipos'}
                  {typeFilter === 'material' && 'Material / Herram.'}
                  {typeFilter === 'epp' && 'EPP'}
                  {typeFilter === 'cargo_personal' && 'Cargo Personal'}
                  {typeFilter === 'uso_diario' && 'Uso Diario'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="material">Material / Herram.</SelectItem>
                <SelectItem value="epp">EPP</SelectItem>
                <SelectItem value="cargo_personal">Cargo Personal</SelectItem>
                <SelectItem value="uso_diario">Uso Diario</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Estado">
                  {statusFilter === 'all' && 'Todos los estados'}
                  {statusFilter === 'pendiente' && 'Pendiente'}
                  {statusFilter === 'procesado' && 'Procesado'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="procesado">Procesado</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
              <SelectTrigger className="w-full sm:w-[190px]">
                <div className="flex items-center gap-2">
                  {sortBy === 'date_desc' && <ArrowDownWideNarrow className="w-4 h-4" />}
                  {sortBy === 'date_asc' && <ArrowUpNarrowWide className="w-4 h-4" />}
                  {sortBy === 'status' && <List className="w-4 h-4" />}
                  <SelectValue placeholder="Ordenar por">
                    {sortBy === 'date_desc' && 'Más recientes'}
                    {sortBy === 'date_asc' && 'Más antiguos'}
                    {sortBy === 'status' && 'Pendientes primero'}
                  </SelectValue>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date_desc">Más recientes</SelectItem>
                <SelectItem value="date_asc">Más antiguos</SelectItem>
                <SelectItem value="status">Pendientes primero</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="hidden sm:flex items-center gap-1 bg-muted p-1 rounded-lg self-start xl:self-auto shrink-0">
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'cards' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              title="Vista de tarjetas"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              title="Vista de tabla"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
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
              {search || statusFilter !== 'all' || typeFilter !== 'all' 
                ? 'Sin resultados para los filtros actuales' 
                : 'Aún no has creado ningún vale.'}
            </p>
            {!search && statusFilter === 'all' && typeFilter === 'all' && (
              <Link href="/dashboard/vales/nuevo" className="text-primary hover:underline font-medium text-sm">
                + Crear el primer vale
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {viewMode === 'table' ? (
            <>
              {/* Table view for desktop/tablet */}
              <div className="hidden sm:block rounded-md border border-border/50 bg-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="w-[100px]">Vale #</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Trabajador</TableHead>
                      <TableHead>Creado Por</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Ítems</TableHead>
                      <TableHead>Estado</TableHead>
                      {(profile?.role === 'admin' || profile?.role === 'bodeguero') && (
                        <TableHead className="w-[100px] text-right">Acciones</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVales.map((vale) => (
                      <TableRow key={vale.id} className="hover:bg-muted/30">
                        <TableCell className="font-mono font-medium">#{vale.vale_number}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="uppercase text-[10px]">
                            {vale.type.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>{vale.worker?.name || 'N/A'}</TableCell>
                        <TableCell>{vale.creator?.full_name || 'N/A'}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(vale.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                        </TableCell>
                        <TableCell>{vale.items?.length || 0}</TableCell>
                        <TableCell>
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
                        </TableCell>
                        {(profile?.role === 'admin' || profile?.role === 'bodeguero') && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {vale.status === 'pendiente' && (
                                <Link 
                                  href={`/dashboard/vales/editar/${vale.id}`}
                                  className={buttonVariants({ variant: "ghost", size: "icon", className: "h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-500/10" })}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Link>
                              )}
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteVale(vale)}
                                disabled={deletingId === vale.id}
                              >
                                {deletingId === vale.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Cards fallback for mobile */}
              <div className="block sm:hidden grid gap-4">
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
                        {(profile?.role === 'admin' || profile?.role === 'bodeguero') && (
                          <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-border/50">
                            {vale.status === 'pendiente' && (
                              <Link 
                                href={`/dashboard/vales/editar/${vale.id}`}
                                className={buttonVariants({ variant: "outline", size: "sm", className: "h-8 text-blue-500 hover:text-blue-600" })}
                              >
                                <Pencil className="w-3.5 h-3.5 mr-1.5" /> Editar
                              </Link>
                            )}
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeleteVale(vale)}
                              disabled={deletingId === vale.id}
                            >
                              {deletingId === vale.id ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />} 
                              Eliminar
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
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
                      {(profile?.role === 'admin' || profile?.role === 'bodeguero') && (
                        <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-border/50">
                          {vale.status === 'pendiente' && (
                            <Link 
                              href={`/dashboard/vales/editar/${vale.id}`}
                              className={buttonVariants({ variant: "outline", size: "sm", className: "h-8 text-blue-500 hover:text-blue-600" })}
                            >
                              <Pencil className="w-3.5 h-3.5 mr-1.5" /> Editar
                            </Link>
                          )}
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteVale(vale)}
                            disabled={deletingId === vale.id}
                          >
                            {deletingId === vale.id ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />} 
                            Eliminar
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
