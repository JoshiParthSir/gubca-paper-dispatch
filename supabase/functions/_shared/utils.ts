// @ts-nocheck
import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export function adminClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) {
    throw new HttpError(500, 'Server configuration error. Please contact the administrator.')
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// Verifies the caller's JWT and that they hold the chairperson role.
// JWT verification happens here (not at the gateway) so the functions keep
// working with Supabase's asymmetric JWT signing keys.
export async function requireChairperson(req: Request, admin: SupabaseClient): Promise<User> {
  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.replace(/^Bearer\s+/i, '')
  if (!token) throw new HttpError(401, 'Authentication required. Please sign in again.')

  const { data: { user }, error } = await admin.auth.getUser(token)
  if (error || !user) throw new HttpError(401, 'Your session has expired. Please sign in again.')

  const { data: isChair, error: roleError } = await admin.rpc('check_user_role', {
    _user_id: user.id,
    _role: 'chairperson',
  })
  if (roleError) throw new HttpError(500, `Role verification failed: ${roleError.message}`)
  if (!isChair) throw new HttpError(403, 'Only the chairperson can manage college admins')

  return user
}

// Ensures the target account is a college admin, so these functions can
// never be used to modify or delete a chairperson account.
export async function requireCollegeAdminTarget(admin: SupabaseClient, userId: string) {
  if (!userId || typeof userId !== 'string') throw new HttpError(400, 'Missing user_id')
  const { data: isAdmin, error } = await admin.rpc('check_user_role', {
    _user_id: userId,
    _role: 'college_admin',
  })
  if (error) throw new HttpError(500, `Role verification failed: ${error.message}`)
  if (!isAdmin) throw new HttpError(404, 'College admin not found')
}

export function handler(fn: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    try {
      return await fn(req)
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500
      console.error(`[${status}]`, error?.message ?? error)
      return json({ error: error?.message || 'Unknown error occurred' }, status)
    }
  }
}

export async function readJson(req: Request) {
  try {
    return await req.json()
  } catch {
    throw new HttpError(400, 'Invalid JSON body')
  }
}
