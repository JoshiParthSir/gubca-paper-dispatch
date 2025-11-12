// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Update college admin function called')
    
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.log('No authorization header provided')
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      console.log('Missing environment variables')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const token = authHeader.replace('Bearer ', '')
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Verify caller
    console.log('Verifying user authentication')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    if (authError || !user) {
      console.log('Authentication failed:', authError)
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('User authenticated:', user.id)

    // Authorization: only chairperson can update other admins
    console.log('Checking user role for:', user.id)
    const { data: hasRole, error: roleError } = await supabaseAdmin
      .rpc('check_user_role', { _user_id: user.id, _role: 'chairperson' })

    console.log('Role check result:', { hasRole, roleError })

    if (roleError) {
      console.log('Role check error:', roleError)
      return new Response(
        JSON.stringify({ error: `Role verification failed: ${roleError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!hasRole) {
      console.log('User does not have chairperson role')
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Chairperson access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { user_id, full_name, college_id } = await req.json()
    console.log('Request body:', { user_id, full_name, college_id })

    if (!user_id) {
      console.log('Missing user_id in request')
      return new Response(
        JSON.stringify({ error: 'Missing user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const updates: Record<string, unknown> = {}
    if (typeof full_name === 'string') updates.full_name = full_name.trim().substring(0, 100)
    if (college_id === null || typeof college_id === 'string') updates.college_id = college_id

    console.log('Updates to apply:', updates)

    if (Object.keys(updates).length === 0) {
      console.log('No valid fields to update')
      return new Response(
        JSON.stringify({ error: 'No valid fields to update' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Updating profile for user:', user_id)
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('user_id', user_id)

    if (updateError) {
      console.log('Update error:', updateError)
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Profile updated successfully')
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.log('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
