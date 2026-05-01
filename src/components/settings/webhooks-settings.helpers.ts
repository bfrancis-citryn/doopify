export type EventGroup = {
  id: string
  label: string
  description: string
  events: string[]
  comingSoon?: boolean
}

export const WEBHOOK_EVENT_GROUPS: EventGroup[] = [
  {
    id: 'paid_orders',
    label: 'Paid orders',
    description: 'When payment is confirmed.',
    events: ['order.paid'],
  },
  {
    id: 'refunds',
    label: 'Refunds',
    description: 'When money is refunded.',
    events: ['order.refunded', 'refund.issued'],
  },
  {
    id: 'fulfillments',
    label: 'Fulfillments',
    description: 'When fulfillments are created.',
    events: ['fulfillment.created'],
  },
  {
    id: 'customers',
    label: 'Customers',
    description: 'Customer outbound events are not wired yet.',
    events: [],
    comingSoon: true,
  },
]

export function uniqueStrings(values: unknown[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => String(value ?? '').trim()).filter(Boolean))]
}

export function webhookGroupsFromEvents(eventNames: string[] | undefined): string[] {
  const eventSet = new Set(eventNames || [])
  return WEBHOOK_EVENT_GROUPS.filter((group) => !group.comingSoon && group.events.some((eventName) => eventSet.has(eventName))).map(
    (group) => group.id
  )
}

export function webhookEventsFromGroups(groupIds: string[] | undefined): string[] {
  const selected = new Set(groupIds || [])
  const events: string[] = []
  for (const group of WEBHOOK_EVENT_GROUPS) {
    if (!selected.has(group.id) || group.comingSoon) continue
    events.push(...group.events)
  }
  return uniqueStrings(events)
}

export function webhookGroupLabelsFromEvents(eventNames: string[] | undefined): string[] {
  const selectedGroups = webhookGroupsFromEvents(eventNames)
  const labels = selectedGroups
    .map((groupId) => WEBHOOK_EVENT_GROUPS.find((entry) => entry.id === groupId)?.label)
    .filter((label): label is string => Boolean(label))

  const coveredEvents = new Set(webhookEventsFromGroups(selectedGroups))
  const hasCustomEvents = (eventNames || []).some((eventName) => !coveredEvents.has(eventName))
  if (hasCustomEvents) {
    labels.push('Custom events')
  }

  return labels
}
