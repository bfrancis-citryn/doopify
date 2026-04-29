import AbandonedCheckoutsWorkspace from '@/components/abandoned-checkouts/AbandonedCheckoutsWorkspace';

export const metadata = {
  title: 'Doopify | Abandoned Checkouts',
  description: 'Review and recover abandoned checkout sessions.',
};

export default function AdminAbandonedCheckoutsPage() {
  return <AbandonedCheckoutsWorkspace />;
}
