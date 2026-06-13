'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';
import { Bell, Package, FileText, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface NotificationItem {
  id: string;
  type: 'vale_pendiente' | 'bajo_stock';
  title: string;
  description: string;
  time: Date;
  link: string;
}

export function NotificationsMenu() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const { profile } = useAuth();
  const supabase = createClient();

  useEffect(() => {
    if (!profile) return;

    const fetchNotifications = async () => {
      const items: NotificationItem[] = [];

      // 1. Fetch pending vales
      const { data: vales } = await supabase
        .from('vales')
        .select('id, vale_number, created_at, worker:workers(name)')
        .eq('status', 'pendiente')
        .order('created_at', { ascending: false })
        .limit(5);

      if (vales) {
        vales.forEach(vale => {
          const workerName = Array.isArray(vale.worker) ? vale.worker[0]?.name : (vale.worker as any)?.name;
          items.push({
            id: `vale-${vale.id}`,
            type: 'vale_pendiente',
            title: `Vale Pendiente #${vale.vale_number}`,
            description: `${workerName || 'Trabajador'} solicitó un vale.`,
            time: new Date(vale.created_at),
            link: '/dashboard/despacho'
          });
        });
      }

      // 2. Fetch low stock
      if (profile.role === 'admin' || profile.role === 'bodeguero') {
        const { data: lowStock } = await supabase
          .from('products')
          .select('id, name, stock, min_stock')
          .lte('stock', 5)
          .eq('active', true)
          .limit(5);

        if (lowStock) {
          lowStock.forEach(product => {
            items.push({
              id: `stock-${product.id}`,
              type: 'bajo_stock',
              title: `Stock Crítico: ${product.name}`,
              description: `Solo quedan ${product.stock} unidades en bodega.`,
              time: new Date(), // Just current time for stock alerts
              link: '/dashboard/stock'
            });
          });
        }
      }

      // Sort by time descending
      items.sort((a, b) => b.time.getTime() - a.time.getTime());
      
      setNotifications(items);
    };

    fetchNotifications();

    // Set up realtime listeners for new vales and stock changes
    const channel = supabase
      .channel('notifications-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vales' }, () => {
        fetchNotifications();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, supabase]);

  const unreadCount = notifications.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="relative inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 w-9">
        <Bell className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
        {unreadCount > 0 && (
          <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] bg-destructive text-destructive-foreground animate-in zoom-in">
            {unreadCount > 9 ? '9+' : unreadCount}
          </Badge>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0 border-border/50 shadow-xl">
        <DropdownMenuLabel className="p-4 bg-muted/30 border-b">
          <div className="flex items-center justify-between">
            <span className="font-bold">Notificaciones</span>
            <Badge variant="secondary" className="text-xs">
              {unreadCount} nuevas
            </Badge>
          </div>
        </DropdownMenuLabel>
        
        <div className="max-h-[300px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
              <Bell className="w-8 h-8 opacity-20" />
              <p className="text-sm">No tienes notificaciones pendientes</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <DropdownMenuItem key={notif.id} className="p-0 cursor-pointer">
                <Link href={notif.link} className="flex items-start gap-3 p-4 border-b last:border-0 hover:bg-muted/50 transition-colors">
                  <div className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    notif.type === 'vale_pendiente' ? 'bg-blue-500/10 text-blue-500' : 'bg-destructive/10 text-destructive'
                  }`}>
                    {notif.type === 'vale_pendiente' ? <FileText className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold leading-none">{notif.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{notif.description}</p>
                    {notif.type === 'vale_pendiente' && (
                      <p className="text-[10px] text-muted-foreground pt-1">
                        Hace {formatDistanceToNow(notif.time, { locale: es })}
                      </p>
                    )}
                  </div>
                </Link>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
