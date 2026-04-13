export default function DashboardLoading() {
  return (
    <div className="px-8 py-8 space-y-8 max-w-7xl mx-auto animate-pulse">
      {/* Header Skeleton */}
      <div>
        <div className="h-8 bg-[#334155] rounded-md w-1/4 mb-2"></div>
        <div className="h-4 bg-[#334155]/60 rounded-md w-2/4"></div>
      </div>

      {/* Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card p-6 h-[104px] bg-[#1e293b]">
            <div className="h-4 bg-[#334155] rounded w-1/2 mb-3"></div>
            <div className="h-8 bg-[#334155] rounded w-1/4"></div>
          </div>
        ))}
      </div>

      {/* Content Area Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6 h-64 bg-[#1e293b]">
           <div className="h-4 bg-[#334155] rounded w-1/3 mb-6"></div>
           <div className="space-y-4">
             <div className="h-3 bg-[#334155]/60 rounded w-full"></div>
             <div className="h-3 bg-[#334155]/60 rounded w-5/6"></div>
             <div className="h-3 bg-[#334155]/60 rounded w-4/6"></div>
           </div>
        </div>
        <div className="card p-6 h-64 bg-[#1e293b]">
           <div className="h-4 bg-[#334155] rounded w-1/3 mb-6"></div>
           <div className="space-y-4">
             <div className="h-3 bg-[#334155]/60 rounded w-full"></div>
             <div className="h-3 bg-[#334155]/60 rounded w-5/6"></div>
           </div>
        </div>
      </div>
    </div>
  )
}
