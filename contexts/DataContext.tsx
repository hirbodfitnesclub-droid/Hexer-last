import React, { createContext, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useDataManager } from '../hooks/useDataManager';

type DataContextType = ReturnType<typeof useDataManager>;

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const manager = useDataManager(user);

  useEffect(() => {
    if (user) {
      manager.loadInitial();
    }
  }, [user?.id, manager.loadInitial]);

  return (
    <DataContext.Provider value={manager}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
