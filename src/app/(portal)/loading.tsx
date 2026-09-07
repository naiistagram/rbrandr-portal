export default function PortalLoading() {
  return (
    <div className="flex flex-col min-h-screen animate-pulse" aria-busy="true" aria-label="Loading portal page">
      <div className="h-14 border-b border-[var(--border)] px-6 flex items-center">
        <div className="h-4 w-36 rounded bg-[var(--surface-2)]" />
      </div>
      <div className="flex-1 p-6 space-y-5">
        <div className="h-8 w-48 rounded bg-[var(--surface-2)]" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((item) => <div key={item} className="h-28 rounded-xl bg-[var(--surface-2)]" />)}
        </div>
        <div className="h-64 rounded-xl bg-[var(--surface-2)]" />
      </div>
    </div>
  );
}
