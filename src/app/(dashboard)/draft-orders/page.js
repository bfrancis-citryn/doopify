"use client";

import { Suspense } from 'react';
import DraftOrdersWorkspace from '@/components/draft-orders/DraftOrdersWorkspace';

export default function DraftOrdersPage() {
  return (
    <Suspense fallback={null}>
      <DraftOrdersWorkspace />
    </Suspense>
  );
}
