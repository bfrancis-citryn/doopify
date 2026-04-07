export function createSeedCustomers() {
  return [
    {
      id: 'cus_001',
      name: 'Olivia Carter',
      email: 'olivia@northfield.co',
      phone: '(310) 555-0138',
      tags: ['VIP', 'Priority'],
      totalSpent: 1298,
      orderCount: 5,
      lastOrderDate: '2026-04-06T14:12:00Z',
      defaultAddress: '4476 Santa Monica Blvd, Los Angeles, CA',
      notes: 'High-value repeat customer. Prefers fast shipping.',
      recentOrders: ['#1001', '#0977', '#0931'],
    },
    {
      id: 'cus_002',
      name: 'Noah Bennett',
      email: 'noah@westgrid.io',
      phone: '(512) 555-0180',
      tags: ['Fraud review'],
      totalSpent: 349,
      orderCount: 1,
      lastOrderDate: '2026-04-06T12:48:00Z',
      defaultAddress: '9833 Grant Ave, Austin, TX',
      notes: 'Watch payment verification before fulfillment.',
      recentOrders: ['#1002'],
    },
    {
      id: 'cus_003',
      name: 'Emma Diaz',
      email: 'emma@studiorye.com',
      phone: '(805) 555-0127',
      tags: ['Pickup'],
      totalSpent: 582,
      orderCount: 4,
      lastOrderDate: '2026-04-05T21:05:00Z',
      defaultAddress: '14 Canon Perdido St, Santa Barbara, CA',
      notes: 'Frequent POS shopper and local pickup customer.',
      recentOrders: ['#1003', '#0910', '#0848'],
    },
  ];
}

export function formatCustomerMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}
