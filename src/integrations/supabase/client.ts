// project/src/integrations/supabase/client.ts
// Supabase client with fetch timeout and connection health check.

import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Read envs in a way that works for Vite (browser) and also tolerates Next-style names.
const ENV = (typeof import.meta !== 'undefined' ? (import.meta as any).env : {}) as Record<string, any>;

const SUPABASE_URL: string | undefined =
  ENV.VITE_SUPABASE_URL ?? ENV.NEXT_PUBLIC_SUPABASE_URL;

const SUPABASE_ANON_KEY: string | undefined =
  ENV.VITE_SUPABASE_ANON_KEY ?? ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  if (ENV?.DEV) {
    // eslint-disable-next-line no-console
    console.warn('Supabase env missing. Available keys:', Object.keys(ENV));
  }
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

// ---------------------------------------------------------------------------
// Fetch wrapper with timeout (15 seconds default)
// Prevents requests from hanging indefinitely on connection issues.
// ---------------------------------------------------------------------------
const FETCH_TIMEOUT_MS = 15_000;

function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  // Merge our abort signal with any existing signal
  const mergedInit: RequestInit = {
    ...init,
    signal: controller.signal,
  };

  return fetch(input, mergedInit)
    .then((response) => {
      clearTimeout(timeoutId);
      return response;
    })
    .catch((error) => {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(
          'Connection timed out. Please check your internet connection and try again.'
        );
      }
      throw error;
    });
}

// ---------------------------------------------------------------------------
// Connection health check utility
// Returns true if Supabase is reachable, false otherwise.
// ---------------------------------------------------------------------------
export async function checkSupabaseConnection(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8_000);

    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: 'HEAD',
      headers: {
        apikey: SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok || response.status === 400; // 400 = reached but no table specified, still alive
  } catch {
    return false;
  }
}

// Avoid touching localStorage during SSR/tests
const isBrowser = typeof window !== 'undefined' && typeof localStorage !== 'undefined';

// Build auth options conditionally so SSR doesn't choke
const authOptions: Record<string, any> = {
  autoRefreshToken: true,
};
if (isBrowser) {
  authOptions.storage = localStorage;
  authOptions.persistSession = true;
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: authOptions,
  global: {
    fetch: fetchWithTimeout,
  },
});
