import type { Metadata , Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
  title: "Remarks Adding App",
  description: "Upload CSV or Excel files and add remarks",
  keywords: ["CSV", "Excel", "File Processing", "Remarks", "Data"],
  authors: [{ name: "Remarks Adding App Team" }],
};


export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#12182b", 
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
