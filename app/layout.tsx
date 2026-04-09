import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Fault Portal | Customer Care",
  description: "Internal portal for logging faulty product cases",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-1 container mx-auto max-w-6xl px-4 py-6">
              {children}
            </main>
            <footer className="border-t border-gray-200 py-4 text-center text-xs text-gray-400">
              Internal use only — Customer Care Fault Portal
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
