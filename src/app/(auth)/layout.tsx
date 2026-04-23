import Image from "next/image";

export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 justify-center mb-8">
          <Image src="/logo.svg" alt="RBRANDR logo" width={40} height={40} priority />
          <div>
            <p className="text-lg font-bold text-[var(--foreground)] tracking-tight leading-none">RBRANDR</p>
            <p className="text-[10px] text-[var(--foreground-subtle)] uppercase tracking-widest">Client Portal</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
