import WebhookDeliveriesWorkspace from '@/components/webhooks/WebhookDeliveriesWorkspace';

export const metadata = {
  title: 'Doopify | Webhooks',
  description: 'Webhook delivery observability and replay controls.',
};

export default function AdminWebhooksPage() {
  return <WebhookDeliveriesWorkspace />;
}
