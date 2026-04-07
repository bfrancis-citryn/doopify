"use client";

import { createContext, useContext, useMemo, useState } from 'react';
import { createSeedCustomers } from '../lib/customersData';

const CustomersContext = createContext(null);

export function CustomersProvider({ children }) {
  const [customers, setCustomers] = useState(createSeedCustomers());

  const updateCustomer = (customerId, updater) => {
    setCustomers(current => current.map(customer => (customer.id === customerId ? updater(customer) : customer)));
  };

  const value = useMemo(
    () => ({
      customers,
      setCustomers,
      updateCustomer,
    }),
    [customers]
  );

  return <CustomersContext.Provider value={value}>{children}</CustomersContext.Provider>;
}

export function useCustomers() {
  const context = useContext(CustomersContext);
  if (!context) {
    throw new Error('useCustomers must be used within CustomersProvider');
  }

  return context;
}
