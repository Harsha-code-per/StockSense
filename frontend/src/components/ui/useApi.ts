'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

export function useApi<T>(path: string) {
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<{
    path: string;
    version: number;
    data?: T;
    error?: Error;
  }>();
  useEffect(() => {
    const controller = new AbortController();
    api<T>(path, { signal: controller.signal }).then(
      (data) => {
        if (!controller.signal.aborted) setResult({ path, version, data });
      },
      (error: Error) => {
        if (!controller.signal.aborted) setResult({ path, version, error });
      },
    );
    return () => controller.abort();
  }, [path, version]);
  const current =
    result?.path === path && result.version === version ? result : undefined;
  const reload = useCallback(() => setVersion((value) => value + 1), []);
  return {
    data: current?.data,
    error: current?.error,
    loading: !current,
    reload,
  };
}
