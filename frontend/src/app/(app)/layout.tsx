import { Sidebar } from "@/components/layout/Sidebar";
import { MobileDock } from "@/components/layout/MobileDock";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { OnboardingGate } from "@/components/layout/OnboardingGate";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full w-full bg-bg">
      <OnboardingGate />
      <Sidebar />
      <main className="flex-1 min-w-0 lg:ml-[272px] pb-[180px] lg:pb-0">
        <MobileHeader />
        {children}
      </main>
      <MobileDock />
    </div>
  );
}
