import Link from 'next/link';

export default function SharedScanNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0f1e] px-4 text-center">
      <h1 className="text-2xl font-bold text-white">Scan not found</h1>
      <p className="mt-3 text-gray-400">This shared scan link may have expired or been removed.</p>
      <Link
        href="/scan"
        className="mt-6 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-500"
      >
        Run your own free scan
      </Link>
    </div>
  );
}
