import { DashboardView } from "@/components/dashboard/DashboardView";

export default async function DashboardPage() {
  // Auth is handled by middleware — no need to check session here
  return <DashboardView />;
}
