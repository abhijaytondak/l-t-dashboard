// Uniform error handling — callers get { data, error } instead of a throw.

export interface SafeResult<T> {
  data: T | null;
  error: string | null;
}

export async function safeApiCall<T>(fn: () => Promise<T>): Promise<SafeResult<T>> {
  try {
    const data = await fn();
    return { data, error: null };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Something went wrong.";
    return { data: null, error };
  }
}
