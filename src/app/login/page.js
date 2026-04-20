import { Suspense } from 'react';
import LoginPortal from '../../components/auth/LoginPortal';

export const metadata = {
  title: 'Doopify | Secure access',
  description: 'Secure staff sign-in for your Doopify admin.',
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPortal />
    </Suspense>
  );
}
