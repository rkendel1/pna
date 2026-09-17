import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ID8 Decision Readiness Engine POC",
  description: "A Next.js and FeltDB proof of concept for turning events into decision-ready situations.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
