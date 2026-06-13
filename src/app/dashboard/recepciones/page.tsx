'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Search, PackagePlus } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Reception } from '@/lib/types';

export default function RecepcionesPage() {
  const router = useRouter();
  const supabase = createClient();
  const [receptions, setReceptions] = useState<Reception[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchData();
  }, [supabase]);

  const fetchData = async () => {
    const { data: recs } = await supabase
      .from('receptions')
      .select(`
        *,
        receiver:profiles!receptions_received_by_fkey(full_name),
        items:reception_items(*, product:products(name, unit))
      `)
      .order('created_at', { ascending: false })
      .limit(50);
      
    setReceptions(recs as any[] || []);
    setLoading(false);
  };

  const filteredReceptions = receptions.filter(r => {
    if (!search) return true;
    const s = search.toLowerCase();
    return r.supplier.toLowerCase().includes(s) 
      || (r.invoice || '').toLowerCase().includes(s)
      || (r.supplier_rut || '').toLowerCase().includes(s);
  });

  const docTypeLabel = (type: string | null) => {
    switch (type) {
      case 'factura': return 'Factura';
      case 'guia_despacho': return 'Guía';
      case 'boleta': return 'Boleta';
      case 'nota_credito': return 'N. Crédito';
      default: return type || 'Doc.';
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
          <h2 className="text-xl font-bold">Recepciones de Stock</h2>
          <p className="text-muted-foreground text-sm">
            Ingreso de mercadería y actualización de inventario.
          </p>
        </div>
        <Button onClick={() => router.push('/dashboard/recepciones/nuevo')}>
          <PackagePlus className="w-4 h-4 mr-2" />
          Nueva Recepción
        </Button>
      </div>

      <Card className="card-glow border-border/50">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Historial de Recepciones</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar proveedor, factura o RUT..."
              className="pl-9 h-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border/50 overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Recibido por</TableHead>
                  <TableHead className="text-right">Neto</TableHead>
                  <TableHead className="text-right">Total c/IVA</TableHead>
                  <TableHead className="text-right">Ítems</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReceptions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No se encontraron registros de recepción.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredReceptions.map((reception) => (
                    <TableRow key={reception.id}>
                      <TableCell className="text-sm">
                        <div>{format(new Date(reception.created_at), "d MMM yyyy", { locale: es })}</div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(reception.created_at), "HH:mm", { locale: es })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{reception.supplier_name || reception.supplier}</div>
                        {reception.supplier_rut && (
                          <div className="text-xs text-muted-foreground font-mono">{reception.supplier_rut}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px] uppercase">
                            {docTypeLabel(reception.document_type)}
                          </Badge>
                          {reception.invoice ? (
                            <span className="font-mono text-sm">{reception.invoice}</span>
                          ) : (
                            <span className="text-muted-foreground italic text-xs">Sin doc.</span>
                          )}
                        </div>
                        {reception.invoice_date && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {format(new Date(reception.invoice_date + 'T12:00:00'), "d MMM yyyy", { locale: es })}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {reception.receiver?.full_name}
                      </TableCell>
                      <TableCell className="text-right font-medium text-sm">
                        ${(reception.net_amount || 0).toLocaleString('es-CL')}
                      </TableCell>
                      <TableCell className="text-right font-bold text-primary">
                        ${(reception.total_amount || 0).toLocaleString('es-CL')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-bold">{reception.items?.length || 0} prod.</span>
                          <span className="text-[10px] text-muted-foreground">
                            {reception.items?.reduce((acc: number, item: any) => acc + item.quantity, 0)} unid.
                          </span>
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
    </div>
  );
}
