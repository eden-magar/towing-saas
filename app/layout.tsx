import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "מערכת ניהול גרירות",
  description: "מערכת SaaS לניהול חברות גרירה",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body className="bg-slate-900 text-white min-h-screen" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}