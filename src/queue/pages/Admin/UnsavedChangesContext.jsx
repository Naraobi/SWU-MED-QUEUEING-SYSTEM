import { createContext, useCallback, useContext, useRef, useState } from 'react';

const UnsavedChangesContext = createContext(null);

// =====================================================
// UNSAVED CHANGES PROVIDER
// =====================================================
//
// Lets a page (currently just Settings) flag that it has edits
// pending a Save click, and hand over a "discard" callback that
// reverts those edits. AdminShell reads `isDirty` before switching
// sidebar sections so it can prompt instead of silently dropping
// changes, then calls `discardChanges()` if the admin chooses to
// leave anyway.

export function UnsavedChangesProvider({ children }) {
  const [isDirty, setIsDirty] = useState(false);
  const discardRef = useRef(() => {});

  const registerDiscard = useCallback((fn) => {
    discardRef.current = typeof fn === 'function' ? fn : () => {};
  }, []);

  const discardChanges = useCallback(() => {
    discardRef.current();
    setIsDirty(false);
  }, []);

  const value = {
    isDirty,
    setIsDirty,
    registerDiscard,
    discardChanges,
  };

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedChanges() {
  const ctx = useContext(UnsavedChangesContext);

  if (!ctx) {
    throw new Error('useUnsavedChanges must be used inside an UnsavedChangesProvider');
  }

  return ctx;
}
