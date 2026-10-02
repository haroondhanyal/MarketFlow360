import type { Metadata } from "next";
import "./globals.css";
import "./screens.css";
import "./marketing.css";

export const metadata: Metadata = {
  title: "MarketFlow360",
  description: "Marketing, CRM and business digitalization workspace",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
