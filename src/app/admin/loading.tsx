export default function AdminLoading() {
  return (
    <div className="flex flex-col min-h-screen animate-pulse" aria-busy="true" aria-label="Loading admin page">
      <div className="border-b border-[var(--border)] px-6 py-4 space-y-2">
        <div className="h-5 w-28 rounded bg-[var(--surface-2)]" />
        <div className="h-3 w-52 rounded bg-[var(--surface-2)]" />
      </div>
      <div className="flex-1 p-6 space-y-5">
        <div className="h-10 w-full rounded-lg bg-[var(--surface-2)]" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((item) => <div key={item} className="h-28 rounded-xl bg-[var(--surface-2)]" />)}
        </div>
        <div className="h-64 rounded-xl bg-[var(--surface-2)]" />
      </div>
    </div>
  );
}
