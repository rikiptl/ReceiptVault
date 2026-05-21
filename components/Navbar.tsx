import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-gray-900">
          <span className="text-2xl">🧾</span>
          <span className="text-lg">ReceiptVault</span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          <Link
            href="/"
            className="px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="/receipts"
            className="px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          >
            Receipts
          </Link>
          <Link
            href="/api/export?format=csv"
            className="px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          >
            Export
          </Link>
          <Link
            href="/upload"
            className="ml-2 btn-primary text-sm"
          >
            + Upload
          </Link>
        </div>
      </div>
    </nav>
  );
}
