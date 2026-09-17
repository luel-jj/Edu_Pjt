import { AppShellNav } from "@/components/app-shell-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 pt-4 sm:px-6">
      <AppShellNav />
      {children}
    </div>
  );
}
