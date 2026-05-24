import Navbar from "@/components/Navbar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      {/* pb-24 = room for mobile bottom tab bar */}
      <main className="max-w-6xl mx-auto px-4 py-6 pb-24 sm:pb-8">
        {children}
      </main>
    </>
  );
}
