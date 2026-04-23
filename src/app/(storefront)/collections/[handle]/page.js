import { notFound } from 'next/navigation';

import CollectionDetailView from '@/components/storefront/CollectionDetailView';
import {
  getStorefrontCollectionByHandle,
  getStorefrontCollectionSummaries,
} from '@/server/services/collection.service';

export async function generateMetadata({ params }) {
  const { handle } = await params;
  const collection = await getStorefrontCollectionByHandle(handle);

  if (!collection) {
    return {
      title: 'Collection not found',
    };
  }

  return {
    title: `${collection.title} - Doopify`,
    description: collection.description || `Browse ${collection.title} on Doopify.`,
  };
}

export default async function CollectionPage({ params }) {
  const { handle } = await params;
  const collection = await getStorefrontCollectionByHandle(handle);

  if (!collection) {
    notFound();
  }

  let peerCollections = [];

  try {
    const allCollections = await getStorefrontCollectionSummaries();
    peerCollections = allCollections.filter((item) => item.handle !== handle).slice(0, 5);
  } catch (error) {
    console.error('[CollectionPage]', error);
  }

  return <CollectionDetailView collection={collection} peerCollections={peerCollections} />;
}
