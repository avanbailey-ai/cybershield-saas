export default function AuthProviderDivider() {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center" aria-hidden="true">
        <div className="w-full border-t border-gray-800" />
      </div>
      <div className="relative flex justify-center text-xs uppercase tracking-wider">
        <span className="bg-gray-950 px-3 text-gray-500">or continue with email</span>
      </div>
    </div>
  );
}
