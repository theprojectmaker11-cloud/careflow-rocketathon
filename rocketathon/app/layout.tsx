import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "../components/AppShell";
import { CareflowProvider } from "../components/CareflowProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "CareFlow — understand your health information",
    template: "%s · CareFlow",
  },
  description:
    "Describe how you feel, upload a test report, and get a clear, structured explanation of what your results mean and what to do next. AI-assisted health information, reviewed by you.",
  applicationName: "CareFlow",
  robots: { index: false },
};

export const viewport: Viewport = {
  themeColor: "#0a5f6e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        <CareflowProvider>
          <AppShell>{children}</AppShell>
        </CareflowProvider>
      </body>
    </html>
  );
}
