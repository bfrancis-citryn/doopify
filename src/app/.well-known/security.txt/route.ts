import { getPublicStorefrontSettings } from '@/server/services/settings.service'

export const runtime = 'nodejs'

export async function GET() {
  const store = await getPublicStorefrontSettings().catch(() => null)
  const contactEmail = store?.supportEmail || store?.email || 'security@example.com'
  const storeUrl =
    process.env.NEXT_PUBLIC_STORE_URL && process.env.NEXT_PUBLIC_STORE_URL.trim()
      ? process.env.NEXT_PUBLIC_STORE_URL.trim().replace(/\/$/, '')
      : 'https://example.com'

  const body = [
    'Contact: mailto:' + contactEmail,
    'Preferred-Languages: en',
    'Policy: ' + storeUrl + '/privacy',
    'Acknowledgments: ' + storeUrl + '/terms',
    'Expires: 2027-05-05T00:00:00.000Z',
  ].join('\n')

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
