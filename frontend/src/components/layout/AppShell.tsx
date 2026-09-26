'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Sidebar, navigation } from './Sidebar';
export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const title =
    navigation.find(
      ({ href }) => pathname === href || pathname.startsWith(`${href}/`),
    )?.label ?? 'Inventory';
  return (
    <div className="min-h-dvh">
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-4 z-50 rounded-md bg-card p-3 focus:not-sr-only"
      >
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r lg:block">
        <Sidebar />
      </aside>
      <div className="min-w-0 lg:pl-60">
        <header className="flex h-18 items-center justify-between gap-4 border-b bg-card px-4 sm:px-8">
          <div className="flex items-center gap-3">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Open navigation"
                  className="lg:hidden"
                >
                  <Menu />
                </Button>
              </DialogTrigger>
              <DialogContent className="inset-y-0 left-0 h-dvh max-w-72 translate-x-0 translate-y-0 overflow-y-auto rounded-none p-0 sm:max-w-72">
                <DialogTitle className="sr-only">Navigation</DialogTitle>
                <DialogDescription className="sr-only">
                  Navigate StockSense
                </DialogDescription>
                <Sidebar onNavigate={() => setOpen(false)} />
              </DialogContent>
            </Dialog>
            <span className="text-sm font-medium">{title}</span>
          </div>
          <Button variant="ghost" asChild>
            <Link href="/profile">
              <UserRound aria-hidden="true" />
              Account
            </Link>
          </Button>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto max-w-[1440px] min-w-0 p-4 py-7 outline-none sm:p-8 lg:p-10"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
