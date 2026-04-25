export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-4 font-sans text-neutral-900 antialiased">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
