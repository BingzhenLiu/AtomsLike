import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AtomForge — Build small apps with AI",
  description: "Describe an app, watch the build, and refine a working result.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
