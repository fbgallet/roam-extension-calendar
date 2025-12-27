import { useState, useEffect } from "react";

// Global config version counter (outside React)
let globalConfigVersion = 0;
const listeners = new Set();

// Notify all listeners of config change
export const notifyCalendarConfigChanged = () => {
  globalConfigVersion++;
  listeners.forEach((listener) => listener(globalConfigVersion));
};

// Hook to use config version in components - compatible with React 17+
export const useCalendarConfigVersion = () => {
  const [version, setVersion] = useState(globalConfigVersion);

  useEffect(() => {
    // Sync with current version on mount
    if (version !== globalConfigVersion) {
      setVersion(globalConfigVersion);
    }

    const listener = (newVersion) => {
      setVersion(newVersion);
    };
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }, []);

  return version;
};
