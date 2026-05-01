import { redirect } from 'next/navigation';

export default function AdminShippingSetupPage() {
  redirect('/admin/settings/shipping?view=delivery');
}
