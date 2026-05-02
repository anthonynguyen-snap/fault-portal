import { verifySession } from "@/lib/auth";
import { FaultForm } from "@/components/FaultForm";

export default async function NewFaultPage() {
  const session = await verifySession();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Log New Fault</h1>
        <p className="text-sm text-gray-500 mt-1">
          Fill in all required fields and attach any evidence photos or videos.
        </p>
      </div>
      <FaultForm staffName={session?.name ?? ""} />
    </div>
  );
}
