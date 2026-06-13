'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/supabase/auth-context';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/lib/types';
import {
  LayoutDashboard,
  FileText,
  FilePlus,
  PackageCheck,
  Package,
  HardHat,
  Undo2,
} from 'lucide-react';

interface MobileNavItem {
  title: string;
  href: string;
  icon: React.ReactNode;
  roles: UserRole[];
}

const mobileNavItems: MobileNavItem[] = [
  {
    title: 'Inicio',
    href: '/dashboard',
    icon: <LayoutDashboard className="w-5 h-5" />,
    roles: ['admin', 'bodeguero', 'supervisor', 'prevencionista'],
  },
  {
    title: 'Nuevo',
    href: '/dashboard/vales/nuevo',
    icon: <FilePlus className="w-5 h-5" />,
    roles: ['admin', 'supervisor', 'prevencionista', 'bodeguero'],
  },
  {
    title: 'Vales',
    href: '/dashboard/vales',
    icon: <FileText className="w-5 h-5" />,
    roles: ['admin', 'supervisor', 'prevencionista', 'bodeguero'],
  },
  {
    title: 'Despacho',
    href: '/dashboard/despacho',
    icon: <PackageCheck className="w-5 h-5" />,
    roles: ['admin', 'bodeguero'],
  },
  {
    title: 'Préstamos',
    href: '/dashboard/devoluciones',
    icon: <Undo2 className="w-5 h-5" />,
    roles: ['admin', 'bodeguero'],
  },
  {
    title: 'Stock',
    href: '/dashboard/stock',
    icon: <Package className="w-5 h-5" />,
    roles: ['admin', 'bodeguero', 'supervisor', 'prevencionista'],
  },
  {
    title: 'EPP',
    href: '/dashboard/epp',
    icon: <HardHat className="w-5 h-5" />,
    roles: ['admin', 'bodeguero', 'prevencionista'],
  },
];

export function MobileNav() {
  const pathname = usePathname();
  const { profile } = useAuth();

  const filteredItems = mobileNavItems
    .filter((item) => profile && item.roles.includes(profile.role))
    .slice(0, 5); // max 5 items in bottom nav

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-border bg-background shadow-[0_-5px_15px_rgba(0,0,0,0.1)] pb-safe">
      <div className="flex items-center justify-around h-16 px-2">
        {filteredItems.map((item) => {
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-colors min-w-0',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground'
              )}
            >
              {item.icon}
              <span className="text-[10px] font-medium truncate">
                {item.title}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
