import Link from "next/link";

export const metadata = {
  title: "ReceiptVault — Never Lose a Receipt Again",
  description:
    "Snap a photo, let AI extract the data. Search, budget, export for taxes — receipt management made effortless.",
};

// ── Fake receipt cards for hero mockup ────────────────────────────────────────
const MOCK_RECEIPTS = [
  { emoji: "🛒", merchant: "Whole Foods Market", cat: "Groceries",      amount: "$47.32", date: "May 23",  tag: "business",  color: "bg-green-500" },
  { emoji: "⚡", merchant: "AWS",                cat: "Software/SaaS",  amount: "$124.00", date: "May 22", tag: "recurring", color: "bg-purple-500" },
  { emoji: "🍔", merchant: "Shake Shack",        cat: "Food & Dining",  amount: "$18.50", date: "May 21",  tag: "personal",  color: "bg-orange-500" },
];

const FEATURES = [
  {
    icon: "📸",
    title: "Smart OCR Scanning",
    desc: "Snap any receipt — our AI reads merchant, date, total, line items and category instantly. No manual entry.",
    color: "bg-blue-50 text-blue-600",
  },
  {
    icon: "🔍",
    title: "Instant Search",
    desc: "Type anything and find receipts in milliseconds. Searches across merchant, notes, categories and receipt text.",
    color: "bg-purple-50 text-purple-600",
  },
  {
    icon: "📊",
    title: "Spending Analytics",
    desc: "Beautiful charts showing spend by category, monthly trends, year-over-year comparison and top merchants.",
    color: "bg-green-50 text-green-600",
  },
  {
    icon: "🛡️",
    title: "Warranty Tracker",
    desc: "Set warranty expiry dates and get alerts before they run out. Never miss a warranty claim again.",
    color: "bg-yellow-50 text-yellow-600",
  },
  {
    icon: "📤",
    title: "Tax-Ready Export",
    desc: "Generate a formatted PDF tax report grouped by category, or download CSV for your accountant.",
    color: "bg-red-50 text-red-600",
  },
  {
    icon: "💰",
    title: "Budget Tracking",
    desc: "Set monthly spend limits per category. Dashboard shows progress bars so you always know where you stand.",
    color: "bg-indigo-50 text-indigo-600",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Snap or upload",
    desc: "Take a photo with your phone camera or drag-and-drop a PDF. We accept JPG, PNG, WebP and PDF.",
    icon: "📸",
  },
  {
    n: "02",
    title: "AI extracts everything",
    desc: "OCR automatically reads merchant name, date, total, tax, currency and line items — no typing needed.",
    icon: "⚡",
  },
  {
    n: "03",
    title: "Organized forever",
    desc: "Tag, categorize and search. Export for tax season or check your spending trends in one tap.",
    icon: "🗂️",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white overflow-x-hidden">

      {/* ── Landing Navbar ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-gray-950/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 font-bold text-white">
            <span className="text-2xl">🧾</span>
            <span className="text-lg tracking-tight">ReceiptVault</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="hidden sm:block text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5"
            >
              Sign in
            </Link>
            <Link
              href="/dashboard"
              className="bg-green-500 hover:bg-green-400 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
            >
              Get Started →
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="relative bg-gray-950 text-white overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-green-600/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-indigo-600/8 rounded-full blur-[100px]" />
        </div>

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
            backgroundSize: "48px 48px",
          }}
        />

        <div className="relative max-w-7xl mx-auto px-6 pt-20 pb-16 lg:pt-28 lg:pb-20">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-1.5 rounded-full text-sm font-medium mb-8">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              OCR-powered · Free to use
            </div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.05] mb-6">
              Every receipt.
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-300">
                Organized. Effortless.
              </span>
            </h1>

            {/* Subline */}
            <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed mb-10">
              Snap a photo, let AI extract the data automatically. Search instantly,
              track warranties, export for taxes — all your receipts in one place.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/dashboard"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 text-white font-bold px-8 py-4 rounded-2xl text-base transition-all hover:scale-[1.03] hover:shadow-[0_0_32px_rgba(34,197,94,0.4)] active:scale-[0.98]"
              >
                Get Started Free
                <span className="text-lg">→</span>
              </Link>
              <a
                href="#features"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-gray-300 hover:text-white border border-white/10 hover:border-white/20 font-medium px-8 py-4 rounded-2xl text-base transition-all hover:bg-white/5"
              >
                See features ↓
              </a>
            </div>
          </div>

          {/* ── Floating receipt card mockup ───────────────────────────────── */}
          <div className="relative mt-20 max-w-md mx-auto h-64">
            {MOCK_RECEIPTS.map((r, i) => (
              <div
                key={r.merchant}
                className="absolute w-full bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4"
                style={{
                  top:       `${i * 14}px`,
                  left:      `${i * 6}px`,
                  right:     `${i * 6}px`,
                  transform: `rotate(${[-4, -1.5, 1][i]}deg)`,
                  zIndex:    i + 1,
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{r.emoji}</span>
                    <div>
                      <p className="text-white font-semibold text-sm">{r.merchant}</p>
                      <p className="text-gray-500 text-xs">{r.cat} · {r.date}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-bold">{r.amount}</p>
                    <span className={`inline-block mt-0.5 text-[10px] font-medium text-white px-2 py-0.5 rounded-full ${r.color}`}>
                      {r.tag}
                    </span>
                  </div>
                </div>
                {/* Mini progress bar */}
                <div className="mt-3 h-1 bg-white/10 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${r.color}`} style={{ width: `${[60, 85, 45][i]}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-white/[0.02] to-transparent" />
      </section>

      {/* ── Stats strip ─────────────────────────────────────────────────────── */}
      <section className="bg-green-600 text-white">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="grid grid-cols-3 divide-x divide-green-500">
            {[
              { icon: "⚡", stat: "< 10 sec",  label: "to scan a receipt"    },
              { icon: "🔍", stat: "Full text",  label: "OCR search"           },
              { icon: "📤", stat: "PDF + CSV",  label: "tax-ready exports"    },
            ].map((s) => (
              <div key={s.label} className="text-center px-4 py-2">
                <p className="text-2xl mb-0.5">{s.icon}</p>
                <p className="font-black text-lg leading-tight">{s.stat}</p>
                <p className="text-green-200 text-xs">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features grid ───────────────────────────────────────────────────── */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          {/* Section header */}
          <div className="text-center mb-16">
            <p className="text-green-600 font-semibold text-sm uppercase tracking-widest mb-3">
              Everything you need
            </p>
            <h2 className="text-4xl sm:text-5xl font-black text-gray-900 tracking-tight">
              Built for real receipt management
            </h2>
            <p className="text-gray-500 mt-4 text-lg max-w-xl mx-auto">
              Not just storage — a complete system for capturing, organizing and reporting on your spending.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group relative bg-white border border-gray-100 rounded-3xl p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-4 ${f.color}`}>
                  {f.icon}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
                {/* Hover accent */}
                <div className="absolute inset-0 rounded-3xl ring-2 ring-green-500 ring-offset-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Real-world scenarios ────────────────────────────────────────────── */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-green-600 font-semibold text-sm uppercase tracking-widest mb-3">
              Real-life use cases
            </p>
            <h2 className="text-4xl sm:text-5xl font-black text-gray-900 tracking-tight">
              Never miss a return window
            </h2>
            <p className="text-gray-500 mt-4 text-lg max-w-xl mx-auto">
              Returns are stressful when you can&apos;t find the receipt. ReceiptVault makes it instant.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Scenario 1 */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 group">
              <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center text-2xl mb-5">👗</div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full">8 days left to return</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Wrong size from online order</h3>
              <p className="text-gray-500 text-sm leading-relaxed mb-4">
                Ordered a jacket online — wrong size. Search &ldquo;jacket&rdquo; or &ldquo;H&M&rdquo; and find the receipt instantly. Set a return deadline so you never miss the window.
              </p>
              <div className="bg-gray-50 rounded-xl p-3 text-xs font-mono text-gray-600 space-y-1">
                <p>🔍 Search: <span className="text-green-700 font-bold">&ldquo;jacket&rdquo;</span></p>
                <p>📅 Return deadline: <span className="text-orange-600 font-bold">Dec 15 (8 days)</span></p>
                <p>📦 Status: <span className="text-orange-600 font-bold">Pending return</span></p>
              </div>
            </div>

            {/* Scenario 2 */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 group">
              <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center text-2xl mb-5">📡</div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-full">⚠️ 2 days left!</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Incompatible electronics</h3>
              <p className="text-gray-500 text-sm leading-relaxed mb-4">
                Bought a router that doesn&apos;t work with your setup. Best Buy has a 15-day return policy. ReceiptVault alerts you before it expires — no scrambling.
              </p>
              <div className="bg-gray-50 rounded-xl p-3 text-xs font-mono text-gray-600 space-y-1">
                <p>🔍 Search: <span className="text-green-700 font-bold">&ldquo;router&rdquo;</span></p>
                <p>📅 Return deadline: <span className="text-red-600 font-bold">Tomorrow (urgent!)</span></p>
                <p>🚨 Alert: <span className="text-red-600 font-bold">2 days left — act now</span></p>
              </div>
            </div>

            {/* Scenario 3 */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 group">
              <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center text-2xl mb-5">☕</div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-full">✅ Return completed</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Defective appliance claim</h3>
              <p className="text-gray-500 text-sm leading-relaxed mb-4">
                Coffee maker stopped working after 3 months. Manufacturer 1-year warranty applies. Search &ldquo;coffee maker&rdquo;, find the receipt, and submit the claim — done.
              </p>
              <div className="bg-gray-50 rounded-xl p-3 text-xs font-mono text-gray-600 space-y-1">
                <p>🔍 Search: <span className="text-green-700 font-bold">&ldquo;coffee maker&rdquo;</span></p>
                <p>🛡️ Warranty: <span className="text-green-700 font-bold">Valid (9 months left)</span></p>
                <p>✅ Status: <span className="text-green-600 font-bold">Claim submitted</span></p>
              </div>
            </div>
          </div>

          {/* Bottom CTA within section */}
          <div className="text-center mt-12">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-green-700 font-semibold hover:text-green-600 transition-colors"
            >
              Start tracking your returns →
            </Link>
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────────── */}
      <section className="py-24 bg-gray-950 text-white relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-green-600/8 rounded-full blur-[100px]" />
        </div>

        <div className="relative max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-green-400 font-semibold text-sm uppercase tracking-widest mb-3">
              Simple as 1 – 2 – 3
            </p>
            <h2 className="text-4xl sm:text-5xl font-black tracking-tight">
              How it works
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connecting line (desktop) */}
            <div className="hidden md:block absolute top-10 left-[calc(16.66%+2rem)] right-[calc(16.66%+2rem)] h-px bg-gradient-to-r from-transparent via-green-500/40 to-transparent" />

            {STEPS.map((s, i) => (
              <div key={s.n} className="relative text-center">
                {/* Step number ring */}
                <div className="relative inline-flex mb-6">
                  <div className="w-20 h-20 rounded-2xl bg-gray-900 border border-white/10 flex items-center justify-center text-4xl">
                    {s.icon}
                  </div>
                  <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-green-500 text-white text-xs font-black flex items-center justify-center">
                    {i + 1}
                  </span>
                </div>
                <h3 className="text-xl font-bold mb-3">{s.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed max-w-xs mx-auto">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────────────── */}
      <section className="py-24 bg-white relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-green-100 rounded-full blur-[100px] opacity-60" />
        </div>

        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-1.5 rounded-full text-sm font-medium mb-8">
            🎉 Free forever · No credit card needed
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-gray-900 tracking-tight mb-5">
            Start organizing your
            <br />
            <span className="text-green-600">receipts today</span>
          </h2>
          <p className="text-gray-500 text-lg mb-10">
            Join ReceiptVault and never scramble for a receipt again at tax time.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-3 bg-gray-950 hover:bg-gray-800 text-white font-bold px-10 py-5 rounded-2xl text-lg transition-all hover:scale-[1.03] hover:shadow-2xl active:scale-[0.98]"
          >
            <span>🧾</span>
            Get Started — It&apos;s Free
            <span>→</span>
          </Link>
          <p className="text-gray-400 text-sm mt-5">Takes less than 30 seconds to set up</p>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="bg-gray-950 text-gray-500 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 text-white font-bold">
            <span className="text-xl">🧾</span>
            ReceiptVault
          </Link>
          <p className="text-sm">
            © {new Date().getFullYear()} ReceiptVault. Built for everyday people.
          </p>
          <Link
            href="/dashboard"
            className="text-sm text-green-400 hover:text-green-300 font-medium transition-colors"
          >
            Open App →
          </Link>
        </div>
      </footer>

    </div>
  );
}
