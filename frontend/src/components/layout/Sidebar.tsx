'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  Boxes,
  ClipboardCheck,
  History,
  LayoutDashboard,
  LogOut,
  Package,
  UserRound,
  Warehouse,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
export const navigation = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/products', label: 'Products', icon: Package },
  { href: '/operations/receipts', label: 'Receipts', icon: ArrowDownToLine },
  {
    href: '/operations/deliveries',
    label: 'Deliveries',
    icon: ArrowUpFromLine,
  },
  { href: '/operations/transfers', label: 'Transfers', icon: ArrowLeftRight },
  {
    href: '/operations/adjustments',
    label: 'Adjustments',
    icon: ClipboardCheck,
  },
  { href: '/history', label: 'Move history', icon: History },
  { href: '/warehouses', label: 'Warehouses', icon: Warehouse },
  { href: '/profile', label: 'Profile', icon: UserRound },
];
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch {
      // Even if network fails, proceed with client redirection.
    } finally {
      onNavigate?.();
      router.push('/login');
      router.refresh();
    }
  }

  return (
    <div className="flex h-full flex-col bg-card px-4 py-6">
      <Link
        href="/products"
        onClick={onNavigate}
        className="mb-9 flex items-center gap-3 px-3 text-lg font-semibold tracking-tight"
      >
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Boxes className="size-5" aria-hidden="true" />
        </span>
        StockSense
      </Link>
      <nav aria-label="Main navigation" className="space-y-1">
        {navigation.map(({ href, label, icon: Icon }, index) => (
          <div key={href}>
            {index === 2 && (
              <p className="px-3 pb-2 pt-5 text-xs font-medium text-muted-foreground">
                Operations
              </p>
            )}
            {index === 6 && <div className="my-5 border-t" />}
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={
                pathname === href || pathname.startsWith(`${href}/`)
                  ? 'page'
                  : undefined
              }
              className={cn(
                'flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors duration-150 hover:bg-muted',
                pathname === href || pathname.startsWith(`${href}/`)
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground',
              )}
            >
              <Icon className="size-[18px]" aria-hidden="true" />
              {label}
            </Link>
          </div>
        ))}
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className={cn(
            'flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted disabled:pointer-events-none disabled:opacity-50',
          )}
        >
          <LogOut className="size-[18px]" aria-hidden="true" />
          Logout
        </button>
      </nav>
      <p className="mt-auto px-3 pt-10 text-xs leading-5 text-muted-foreground">
        Every movement.
        <br />
        Accounted for.
      </p>
    </div>
  );
}
