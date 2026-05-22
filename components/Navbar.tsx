"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV_LINKS = [
  { href: "/",           label: "Dashboard",  icon: "🏠" },
  { href: "/receipts",   label: "Receipts",   icon: "🧾" },
  { href: "/upload",     label: "Upload",     icon: "📸" },
  { href: "/warranties", label: "Warranties", icon: "🛡️" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-bold text-gray-900">
            <span className="text-2xl">🧾</span>
            <span className="text-base sm:text-lg">ReceiptVault</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-1">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  pathname === l.href
                    ? "bg-brand-50 text-brand-700 font-medium"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                {l.label}
              </Link>
            ))}
            <a
              href="/api/export?format=csv"
              className="px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
              Export
            </a>
            <Link href="/upload" className="ml-2 btn-primary text-sm">
              + Upload
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="sm:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100"
            onClick={() => setOpen((o) => !o)}
            aria-label="Menu"
          >
            <div className="w-5 space-y-1">
              <span className={`block h-0.5 bg-current transition-transform ${open ? "rotate-45 translate-y-1.5" : ""}`} />
              <span className={`block h-0.5 bg-current transition-opacity ${open ? "opacity-0" : ""}`} />
              <span className={`block h-0.5 bg-current transition-transform ${open ? "-rotate-45 -translate-y-1.5" : ""}`} />
            </div>
          </button>
        </div>

        {/* Mobile dropdown */}
        {open && (
          <div className="sm:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-1">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  pathname === l.href
                    ? "bg-brand-50 text-brand-700"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <span className="text-lg">{l.icon}</span>
                {l.label}
              </Link>
            ))}
            <a
              href="/api/export?format=csv"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <span className="text-lg">📥</span>
              Export CSV
            </a>
          </div>
        )}
      </nav>

      {/* ── Mobile bottom tab bar ────────────────────────────────────────── */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 flex">
        {NAV_LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`flex-1 flex flex-col items-center justify-center py-2 text-xs transition-colors ${
              pathname === l.href
                ? "text-brand-600 font-semibold"
                : "text-gray-500"
            }`}
          >
            <span className="text-xl mb-0.5">{l.icon}</span>
            {l.label}
          </Link>
        ))}
      </div>
    </>
  );
}
