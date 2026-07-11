import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "./lib/AuthContext";
import Footer from "./components/ui/Footer";

export const metadata: Metadata = {
  title: "מגרר - מערכת ניהול גרירות",
  description: "מערכת SaaS לניהול חברות גרירה",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "מגרר",
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#0d1b3e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body className="bg-slate-900 h-screen overflow-hidden flex flex-col" suppressHydrationWarning>
        <AuthProvider>
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
            {children}
          </div>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
