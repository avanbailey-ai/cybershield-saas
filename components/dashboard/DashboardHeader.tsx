interface DashboardHeaderProps {
  email: string;
  title?: string;
}

export default function DashboardHeader({
  email,
  title = "Dashboard",
}: DashboardHeaderProps) {
  const initial = email.charAt(0).toUpperCase();

  return (
    <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-gray-800 bg-gray-950 px-6">
      <h1 className="text-base font-semibold text-white">{title}</h1>

      <div className="flex items-center gap-3">
        {/* Notifications bell */}
        <button
          className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
          aria-label="Notifications"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </button>

        {/* Divider */}
        <div className="h-6 w-px bg-gray-800" />

        {/* User info */}
        <div className="flex items-center gap-2.5">
          <div className="hidden text-right sm:block">
            <p className="text-xs text-gray-500">Signed in as</p>
            <p className="max-w-[180px] truncate text-xs font-medium text-gray-300">{email}</p>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
            {initial}
          </div>
        </div>
      </div>
    </header>
  );
}
