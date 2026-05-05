import { Suspense } from 'react';
import JoinPortal from '@/components/auth/JoinPortal';

export const metadata = {
  title: 'Doopify | Accept your invitation',
  description: 'Accept your team invitation and create your Doopify account.',
};

export default function JoinPage() {
  return (
    <Suspense fallback={null}>
      <JoinPortal />
    </Suspense>
  );
}
