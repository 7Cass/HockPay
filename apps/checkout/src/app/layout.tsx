import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Hockpay - Checkout',
  description: 'Pagamento Pix seguro',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <main className="min-h-screen flex items-center justify-center p-4">
          <div className="w-full max-w-lg">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
