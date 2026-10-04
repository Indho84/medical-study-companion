import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Medical Study Companion",
  description: "Turn lecture slides into spot notes, mind maps, flashcards and exam-style quizzes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <Link href="/" className="brand">
            <span aria-hidden>🩺</span> Study Companion
          </Link>
          <nav className="nav">
            <Link href="/">Library</Link>
            <Link href="/review">Review due cards</Link>
          </nav>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
