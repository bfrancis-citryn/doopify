import WebhookDeliveriesWorkspace from '@/components/webhooks/WebhookDeliveriesWorkspace';

export const metadata = {
  title: 'Doopify | Delivery Observability',
  description: 'Inbound webhooks, outbound webhooks, and transactional email delivery observability.',
};

export default function AdminWebhooksPage() {
  return <WebhookDeliveriesWorkspace />;
}
