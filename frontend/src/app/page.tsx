import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Landing } from '@/components/landing/Landing';
import { SESSION_COOKIE } from '@/lib/session';

export const metadata: Metadata = {
  title: 'StockSense: every movement, accounted for',
};

// Signed-in users go straight to the dashboard; everyone else sees the landing page.
export default async function Home() {
  if ((await cookies()).has(SESSION_COOKIE)) redirect('/dashboard');
  return <Landing />;
}
