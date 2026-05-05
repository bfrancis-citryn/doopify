import { Suspense } from 'react';
import CreateOwnerPortal from '@/components/auth/CreateOwnerPortal';

export const metadata = {
  title: 'Doopify | Create owner account',
  description: 'First-run setup: create the owner account for your Doopify store.',
};

export default function CreateOwnerPage() {
  return (
    <Suspense fallback={null}>
      <CreateOwnerPortal />
    </Suspense>
  );
}
