import React from "react";
import { useAuth } from "./AuthContext";

export function AdminRoute({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-white/50">
        Authenticating Admin...
      </div>
    );
  }

  if (!user || !isAdmin) {
    if (fallback) return <>{fallback}</>;

    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center gap-3 bg-[#0A0A0D] text-white">
        <span className="text-5xl">🔒</span>
        <h2 className="text-lg font-bold">Admin Panel Access Restricted</h2>
        <p className="max-w-xs text-xs text-white/50">
          This panel requires Admin role permissions. Please sign in with an authorized Admin account.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
