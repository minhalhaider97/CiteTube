import { supabase } from './auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetcher(endpoint: string, options: RequestInit = {}) {
  const authHeaders = await getAuthHeader();
  
  // Explicitly normalize options.headers into a standard Record object
  const customHeaders = (options.headers || {}) as Record<string, string>;

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...customHeaders,
    },
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(errorBody || `API error: ${res.status}`);
  }
  return res.json();
}