import './globals.css';
import type { Metadata, Viewport } from 'next';
import AppLayout from '@/components/AppLayout';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // Previene zoom accidental en inputs de Android / iOS
  themeColor: '#131E17', // Verde militar oscuro para la barra de estado nativa
};

export const metadata: Metadata = {
  title: 'SivarStock - Control de Inventario y Activos Empresariales',
  description: 'Sistema empresarial de gestión y control de inventario físico y digital para empresas manufactureras.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SivarStock',
  },
  formatDetection: {
    telephone: true,
    date: false,
    address: false,
    email: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-slate-50 antialiased selection:bg-military-200 selection:text-military-900">
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  );
}
