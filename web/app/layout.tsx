import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// La fuente del prototipo. next/font la descarga al compilar y la sirve
// desde el propio sitio: el navegador no le pide nada a Google.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LavaSmart",
  description: "Gestión operativa de AquaBrillo",
  icons: { icon: "/marca/logo.png" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
