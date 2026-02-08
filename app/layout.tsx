import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "./lib/AuthContext";

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
<body className="bg-slate-900 min-h-screen" suppressHydrationWarning>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}