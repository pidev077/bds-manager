export default function LoadingState({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-3 border-b border-gray-100">
          {[140, 100, 80, 120, 90, 100, 80].map((w, j) => (
            <div key={j} className="h-4 bg-gray-200 rounded" style={{ width: w }} />
          ))}
        </div>
      ))}
    </div>
  )
}
