import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Passionfruit",
  description:
    "A persistent AI mentor that turns a middle-schooler's interests into real, portfolio-worthy projects.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  );
}
