import './globals.css';
import type { Metadata } from 'next';
import AppLayout from '@/components/AppLayout';

export const metadata: Metadata = {
  title: 'SivarStock - Control de Inventario y Activos Empresariales',
  description: 'Sistema empresarial de gestión y control de inventario físico y digital para empresas manufactureras.',
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
