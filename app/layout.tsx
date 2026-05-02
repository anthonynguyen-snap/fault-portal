import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Providers from '@/components/Providers';
import { SidebarProvider } from '@/components/layout/SidebarContext';
import { headers } from 'next/headers';

export const metadata: Metadata = {
  title: 'SNAP Customer Care Portal',
  description: 'Internal fault tracking portal for customer care teams',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'SNAP Portal',
    statusBarStyle: 'black-translucent',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const pathname = headersList.get('x-pathname') || '';
  const isLoginPage = pathname === '/login' || pathname.startsWith('/login');

  if (isLoginPage) {
    return (
      <html lang="en">
        <head>
          <link rel="apple-touch-icon" href="/snap-logo.jpg" />
          <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        </head>
        <body>
          <Providers>{children}</Providers>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/snap-logo.jpg" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body>
        <SidebarProvider>
          <div className="flex h-screen overflow-hidden bg-slate-50">
            {/* Sidebar Navigation */}
            <Sidebar />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
              <Header />
              <main className="flex-1 overflow-y-auto">
                <div className="min-h-full p-4 md:p-6 lg:p-8">
                  <Providers>{children}</Providers>
                </div>
              </main>
            </div>
          </div>
        </SidebarProvider>
      </body>
    </html>
  );
}
