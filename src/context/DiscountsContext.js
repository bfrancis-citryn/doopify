"use client";

import { createContext, useContext, useMemo, useState } from 'react';
import { createSeedDiscounts } from '../lib/discountsData';

const DiscountsContext = createContext(null);

export function DiscountsProvider({ children }) {
  const [discounts, setDiscounts] = useState(createSeedDiscounts());

  const addDiscount = discount => {
    setDiscounts(current => [discount, ...current]);
  };

  const updateDiscount = (discountId, updater) => {
    setDiscounts(current => current.map(discount => (discount.id === discountId ? updater(discount) : discount)));
  };

  const value = useMemo(
    () => ({
      discounts,
      setDiscounts,
      addDiscount,
      updateDiscount,
    }),
    [discounts]
  );

  return <DiscountsContext.Provider value={value}>{children}</DiscountsContext.Provider>;
}

export function useDiscounts() {
  const context = useContext(DiscountsContext);
  if (!context) {
    throw new Error('useDiscounts must be used within DiscountsProvider');
  }

  return context;
}
