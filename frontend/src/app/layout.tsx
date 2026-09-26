import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });
export const metadata: Metadata = {
  title: { default: 'StockSense', template: '%s | StockSense' },
  description: 'Inventory, locations, and stock movements in one place.',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geist.variable} font-sans antialiased`}>
        {children}
        <Toaster richColors closeButton />
      </body>
    </html>
  );
}
