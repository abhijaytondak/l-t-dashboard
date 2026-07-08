import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LT Verify — Reviewer console",
  description: "L&T × SalarySe communication-reimbursement verification console.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
