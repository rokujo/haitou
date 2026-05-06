import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "./components/AuthProvider";
import Header from "./components/Header";

export const metadata: Metadata = {
  title: "配当利回りウォッチャー",
  description: "日本株の配当利回りと目標利回りの乖離をランキング表示",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#1a1a2e",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-bg text-slate-200">
        <AuthProvider>
          <Header />
          <main className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
