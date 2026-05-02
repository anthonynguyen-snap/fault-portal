"use client";
import Link from "next/link";
import { ShieldX } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";

export default function UnauthorizedPage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="card w-full max-w-sm p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 text-red-600">
          <ShieldX className="h-8 w-8" />
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-2">Access Restricted</h1>
        <p className="text-sm text-gray-500 mb-2">
          This section is only available to admin users.
        </p>
        {user?.email && (
          <p className="text-xs text-gray-400 mb-6">
            Signed in as <span className="font-medium">{user.email}</span>
          </p>
        )}

        <div className="flex flex-col gap-2">
          <Link href="/" className="btn-primary w-full text-sm py-2">
            Back to Dashboard
          </Link>
          <button
            onClick={logout}
            className="btn-secondary w-full text-sm py-2"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
