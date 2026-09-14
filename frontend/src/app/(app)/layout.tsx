import { Sidebar } from "@/components/layout/Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full w-full">
      <Sidebar />
      <main className="flex-1 overflow-auto ml-60">{children}</main>
    </div>
  );
}
