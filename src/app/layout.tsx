import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import { Nav } from "@/components/Nav";
import { Backdrop } from "@/components/Backdrop";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const display = Space_Grotesk({ variable: "--font-display", subsets: ["latin"], weight: ["500", "700"] });

export const metadata: Metadata = {
  title: "InterviewAI — AI Interview & Career Simulator",
  description:
    "Practise real interviews with an AI interviewer. Voice or text, instant scoring on clarity, depth and relevance, report cards and progress tracking.",
};

export const viewport: Viewport = { themeColor: "#05060f" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${display.variable} h-full antialiased`}>
      <body className="relative min-h-full flex flex-col overflow-x-hidden">
        <Backdrop />
        <Nav />
        <main className="relative z-10 flex-1">{children}</main>
        <footer className="relative z-10 border-t border-white/5 py-8 text-center text-sm text-white/40">
          © {2026} InterviewAI · Built with Next.js & Claude · Practise smarter, get hired faster.
        </footer>
      </body>
    </html>
  );
}
