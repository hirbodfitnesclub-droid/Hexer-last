import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: any;

const encoder = new TextEncoder();
const requestWindows = new Map<string, { count: number; resetAt: number }>();

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function jsonResponse(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

export function getAllowedCorsHeaders(req: Request, allowedMethods = 'POST, OPTIONS'): Record<string, string> {
  const origin = req.headers.get('origin');
  const configured = (Deno.env.get('ALLOWED_ORIGINS') || '')
    .split(',')
    .map((value: string) => value.trim())
    .filter(Boolean);
  const localOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];
  const allowed = configured.length > 0 ? configured : localOrigins;

  return {
    'Access-Control-Allow-Origin': origin && allowed.includes(origin) ? origin : allowed[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-worker-secret',
    'Access-Control-Allow-Methods': allowedMethods,
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const encoded = token.split('.')[1];
  if (!encoded) return {};
  try {
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(atob(padded));
  } catch {
    return {};
  }
}

export async function requireUser(req: Request): Promise<{
  user: any;
  client: SupabaseClient;
  claims: Record<string, unknown>;
}> {
  const authorization = req.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    throw new HttpError(401, 'Unauthorized');
  }

  const url = Deno.env.get('SUPABASE_URL');
  const publishableKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !publishableKey) {
    throw new HttpError(500, 'Auth configuration is missing');
  }

  const client = createClient(url, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) {
    throw new HttpError(401, 'Unauthorized');
  }

  return {
    user,
    client,
    claims: decodeJwtPayload(authorization.slice('Bearer '.length)),
  };
}

export async function requireAdmin(req: Request): Promise<{
  user: any;
  service: SupabaseClient;
  claims: Record<string, unknown>;
}> {
  const { user, claims } = await requireUser(req);
  const role = user.app_metadata?.role;
  const isAdmin = role === 'admin' || user.app_metadata?.is_admin === true;
  const aal = claims.aal;
  if (!isAdmin) {
    throw new HttpError(403, 'Admin access required');
  }
  if (aal !== 'aal2') {
    throw new HttpError(403, 'MFA assurance level 2 required');
  }

  const url = Deno.env.get('SUPABASE_URL');
  const secretKey = Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !secretKey) {
    throw new HttpError(500, 'Privileged database configuration is missing');
  }

  const service = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { user, service, claims };
}

export async function requireWorkerSecret(req: Request, envName: string): Promise<void> {
  const supplied = req.headers.get('x-worker-secret');
  if (!supplied) throw new HttpError(401, 'Unauthorized worker');

  const expected = Deno.env.get(envName);
  if (expected && await timingSafeEqual(expected, supplied)) return;

  const url = Deno.env.get('SUPABASE_URL');
  const secretKey = Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const vaultName = envName === 'PUSH_DISPATCH_SECRET'
    ? 'push_dispatch_secret'
    : envName === 'VECTORIZE_WORKER_SECRET'
      ? 'vectorize_worker_secret'
      : null;

  if (url && secretKey && vaultName) {
    const service = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await service.rpc('verify_worker_secret', {
      p_name: vaultName,
      p_supplied: supplied,
    });
    if (!error && data === true) return;
  }

  throw new HttpError(401, 'Unauthorized worker');
}

export function enforceRateLimit(req: Request, scope: string, limit: number, windowMs: number): void {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const key = `${scope}:${forwarded || 'unknown'}`;
  const now = Date.now();
  const current = requestWindows.get(key);

  if (!current || current.resetAt <= now) {
    requestWindows.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (current.count >= limit) {
    throw new HttpError(429, 'Too many requests');
  }
  current.count += 1;
}

export async function timingSafeEqual(expected: string, supplied: string): Promise<boolean> {
  const expectedBytes = encoder.encode(expected);
  const suppliedBytes = encoder.encode(supplied);
  if (expectedBytes.length !== suppliedBytes.length) return false;

  const expectedDigest = new Uint8Array(await crypto.subtle.digest('SHA-256', expectedBytes));
  const suppliedDigest = new Uint8Array(await crypto.subtle.digest('SHA-256', suppliedBytes));
  let difference = 0;
  for (let index = 0; index < expectedDigest.length; index += 1) {
    difference |= expectedDigest[index] ^ suppliedDigest[index];
  }
  return difference === 0;
}

export function safeErrorResponse(error: unknown, headers: HeadersInit = {}): Response {
  const status = error instanceof HttpError ? error.status : 500;
  const message = error instanceof HttpError ? error.message : 'Internal server error';
  if (status >= 500) console.error('Unhandled edge function error', error);
  return jsonResponse({ error: message }, status, headers);
}
