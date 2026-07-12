export default function AvailabilityPage() {
  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-brown mb-1">Availability</h1>
      <p className="text-sm text-gray-500 mb-8">Daily inventory grid — Available, Reserved, Occupied, Dirty, Maintenance, Blocked</p>
      <div className="bg-white border border-warm-border rounded-xl p-8 text-center text-gray-400">
        <p className="text-4xl mb-4">📅</p>
        <p className="font-medium text-gray-600 mb-1">Availability Grid</p>
        <p className="text-sm">Coming in Phase 3 — room-by-date grid with color-coded status, inventory by room type, and block/unblock controls.</p>
      </div>
    </div>
  )
}
