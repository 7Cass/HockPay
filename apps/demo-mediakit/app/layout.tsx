import "./globals.css";

export const metadata = {
  title: "Media Kit Generator — Powered by HockPay",
  description: "Gere seu Media Kit profissional em minutos",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
