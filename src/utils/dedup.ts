const pending = new Map<string, Promise<any>>();

const DEDUP_TIMEOUT_MS = 30_000;

export function dedup<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = pending.get(key);
  if (existing) return existing as Promise<T>;

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Dedup timeout for key: ${key}`)), DEDUP_TIMEOUT_MS)
  );

  const promise = Promise.race([fn(), timeout]).then(
    (result) => { pending.delete(key); return result; },
    (err) => { pending.delete(key); throw err; }
  );
  pending.set(key, promise);
  return promise;
}
