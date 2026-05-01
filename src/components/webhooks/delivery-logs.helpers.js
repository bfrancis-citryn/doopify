const DELIVERY_TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: 'inbound', label: 'Provider inbound' },
  { value: 'outbound', label: 'Outbound webhooks' },
  { value: 'email', label: 'Email deliveries' },
];

const DELIVERY_STATUS_OPTIONS = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'PROCESSED', label: 'Processed' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'RETRYING', label: 'Retrying' },
  { value: 'FAILED', label: 'Failed' },
];

const STATUS_FILTER_TO_MODE = {
  inbound: {
    ALL: 'ALL',
    PROCESSED: 'PROCESSED',
    DELIVERED: 'PROCESSED',
    RETRYING: 'RETRY_PENDING',
    FAILED: 'FAILED',
  },
  outbound: {
    ALL: 'ALL',
    PROCESSED: 'SUCCESS',
    DELIVERED: 'SUCCESS',
    RETRYING: 'RETRYING',
    FAILED: 'FAILED',
  },
  email: {
    ALL: 'ALL',
    PROCESSED: 'SENT',
    DELIVERED: 'SENT',
    RETRYING: 'RETRYING',
    FAILED: 'FAILED',
  },
};

function countByStatus(rows, statuses) {
  return rows.filter((row) => statuses.includes(row.status)).length;
}

export function typeToMode(type) {
  if (type === 'outbound') return 'outbound';
  if (type === 'email') return 'email';
  return 'inbound';
}

export function modeToType(mode) {
  if (mode === 'outbound') return 'outbound';
  if (mode === 'email') return 'email';
  return 'inbound';
}

export function getModeStatusFilter(mode, statusFilter) {
  const modeMap = STATUS_FILTER_TO_MODE[mode] || STATUS_FILTER_TO_MODE.inbound;
  return modeMap[statusFilter] || 'ALL';
}

export function buildDeliveryStats({ mode, inboundRows = [], outboundRows = [], emailRows = [], totals = {} }) {
  if (mode === 'outbound') {
    return {
      received: totals.outbound ?? outboundRows.length,
      processed: countByStatus(outboundRows, ['SUCCESS']),
      retrying: countByStatus(outboundRows, ['RETRYING']),
      failed: countByStatus(outboundRows, ['FAILED', 'EXHAUSTED']),
    };
  }

  if (mode === 'email') {
    return {
      received: totals.email ?? emailRows.length,
      processed: countByStatus(emailRows, ['SENT']),
      retrying: countByStatus(emailRows, ['RETRYING', 'RESEND_REQUESTED']),
      failed: countByStatus(emailRows, ['FAILED', 'BOUNCED', 'COMPLAINED']),
    };
  }

  return {
    received: totals.inbound ?? inboundRows.length,
    processed: countByStatus(inboundRows, ['PROCESSED']),
    retrying: countByStatus(inboundRows, ['RETRY_PENDING']),
    failed: countByStatus(inboundRows, ['FAILED', 'SIGNATURE_FAILED', 'RETRY_EXHAUSTED']),
  };
}

export function getDeliveryDisplayStatus(mode, status) {
  if (mode === 'outbound') {
    if (status === 'SUCCESS') return { label: 'Delivered', tone: 'success' };
    if (status === 'RETRYING' || status === 'PENDING') return { label: 'Retrying', tone: 'warning' };
    if (status === 'FAILED' || status === 'EXHAUSTED') return { label: 'Failed', tone: 'danger' };
    return { label: status, tone: 'neutral' };
  }

  if (mode === 'email') {
    if (status === 'SENT') return { label: 'Delivered', tone: 'success' };
    if (status === 'RETRYING' || status === 'RESEND_REQUESTED' || status === 'PENDING') {
      return { label: 'Retrying', tone: 'warning' };
    }
    if (status === 'FAILED' || status === 'BOUNCED' || status === 'COMPLAINED') {
      return { label: 'Failed', tone: 'danger' };
    }
    return { label: status, tone: 'neutral' };
  }

  if (status === 'PROCESSED') return { label: 'Processed', tone: 'success' };
  if (status === 'RETRY_PENDING') return { label: 'Retrying', tone: 'warning' };
  if (status === 'FAILED' || status === 'SIGNATURE_FAILED' || status === 'RETRY_EXHAUSTED') {
    return { label: 'Failed', tone: 'danger' };
  }
  if (status === 'RECEIVED') return { label: 'Received', tone: 'neutral' };
  return { label: status, tone: 'neutral' };
}

function includesSearch(values, searchTerm) {
  const haystack = values.filter(Boolean).join(' ').toLowerCase();
  return haystack.includes(searchTerm.toLowerCase());
}

export function filterDeliveriesBySearch(mode, rows, searchTerm) {
  const needle = String(searchTerm || '').trim();
  if (!needle) return rows;

  return rows.filter((row) => {
    if (mode === 'outbound') {
      return includesSearch(
        [
          row.id,
          row.event,
          row.status,
          row.lastError,
          row.statusCode,
          row.integration?.name,
          row.integration?.webhookUrl,
        ],
        needle
      );
    }

    if (mode === 'email') {
      return includesSearch(
        [
          row.id,
          row.template,
          row.status,
          row.provider,
          row.recipientEmail,
          row.subject,
          row.lastError,
          row.orderId,
          row.customerId,
        ],
        needle
      );
    }

    return includesSearch(
      [row.providerEventId, row.provider, row.eventType, row.status, row.lastError, row.payloadHash],
      needle
    );
  });
}

export { DELIVERY_STATUS_OPTIONS, DELIVERY_TYPE_OPTIONS };
