import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "IronMind AI — Adaptive Endurance Coach",
  description: "AI-powered Ironman 70.3 coaching for Lily Coan · Garmin + Gemini",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex bg-[#080808] text-white">
        <Sidebar />
        <main className="flex-1 overflow-auto ml-60">
          {children}
        </main>
      </body>
    </html>
  );
}
