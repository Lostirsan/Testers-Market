import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import { Header } from "@/components/Header";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Test Traders: indie devs test each other's games", template: "%s · Test Traders" },
  description:
    "Get honest playtest feedback for your indie game. Test other developers' games, earn points, spend them on testers for yours.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-zinc-50 text-zinc-900">
        <Header />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-zinc-200 bg-white py-6 text-center text-sm text-zinc-500">
          <Link href="/rules" className="hover:text-zinc-800">Rules</Link>
          <span className="mx-2">·</span>
          <span>Test Traders © {new Date().getFullYear()}</span>
        </footer>
      </body>
    </html>
  );
}
