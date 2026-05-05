'use client';
import { ToastProvider } from '@/components/ui/Toast';
import { AuthProvider } from '@/components/auth/AuthProvider';
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>{children}</ToastProvider>
    </AuthProvider>
  );
}
