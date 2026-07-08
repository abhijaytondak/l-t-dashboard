// Centralized axios API client (team standard). One `request<T>` wrapper + a
// shared axios instance; per-domain services are built on top. Base URL is
// relative so Next.js rewrites (and the Vite dev proxy before it) route /api to
// the Express server — the browser never learns the server origin or any key.

import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig } from "axios";

const BASE_URL =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_BASE_URL) || "";

export const http: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Perform a request and return the parsed body, normalising axios errors. */
export async function request<T>(path: string, config: AxiosRequestConfig = {}): Promise<T> {
  try {
    const res = await http.request<T>({ url: path, ...config });
    return res.data;
  } catch (err) {
    const ax = err as AxiosError<{ error?: string }>;
    const status = ax.response?.status ?? 0;
    const message = ax.response?.data?.error ?? ax.message ?? `Request failed (${status})`;
    throw new ApiError(message, status);
  }
}
