import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import QueryProvider from "@/components/QueryProvider";
import AuthInitializer from "@/components/AuthInitializer";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title: "El Hornero — Comedores Córdoba",
  description: "Conectamos comedores y merenderos de Córdoba con donantes y voluntarios.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${nunito.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <QueryProvider>
          <AuthInitializer />
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
