import type { Metadata } from "next";
import { Outfit, Space_Grotesk } from "next/font/google";

import "./globals.css";
import { AppProviders } from "@/components/app-providers";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-body"
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display"
});

export const metadata: Metadata = {
  title: "Radar One | 商圈选址助手",
  description:
    "为创业开店者生成可解释的商圈选址建议，整合地点数据、规则评分与智能建议。"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`${outfit.variable} ${spaceGrotesk.variable}`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
