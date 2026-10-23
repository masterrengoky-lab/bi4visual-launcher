import { useCallback, useEffect, useState } from "react";

/** Loads data once and lets the caller reload or replace it. */
export function useLoad<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => {
    setError(null);
    load().then(setData, (e) => setError(String(e)));
  }, [load]);
  useEffect(reload, [reload]);
  return { data, setData, error, reload };
}
