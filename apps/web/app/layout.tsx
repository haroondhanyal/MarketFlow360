import type { Metadata } from "next";
import "./globals.css";
import "./screens.css";
import "./marketing.css";

export const metadata: Metadata = {
  title: "MarketFlow360",
  applicationName: "MarketFlow360",
  description: "Marketing, CRM and business digitalization workspace",
  icons: { icon: "/icon.svg", shortcut: "/icon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
