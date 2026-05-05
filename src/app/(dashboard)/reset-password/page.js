import { Suspense } from 'react';
import ResetPasswordPortal from '@/components/auth/ResetPasswordPortal';

export const metadata = {
  title: 'Doopify | Reset your password',
  description: 'Set a new password for your Doopify account.',
};

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordPortal />
    </Suspense>
  );
}
