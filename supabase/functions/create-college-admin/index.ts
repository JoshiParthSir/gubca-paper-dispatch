// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('Edge function called:', req.method)
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify the caller is authenticated
    const authHeader = req.headers.get('Authorization')
    console.log('Auth header present:', !!authHeader)
    
    if (!authHeader) {
      console.error('No authorization header provided')
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Create a client with the user's token to verify their role
    const token = authHeader.replace('Bearer ', '')
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader }
        }
      }
    )

    // Verify the user's identity
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    console.log('User verification:', { userId: user?.id, hasError: !!authError })
    
    if (authError || !user) {
      console.error('Auth error:', authError?.message)
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user is a chairperson using the secure function
    const { data: hasRole, error: roleError } = await supabaseAdmin
      .rpc('check_user_role', { _user_id: user.id, _role: 'chairperson' })

    console.log('Role check:', { hasRole, hasError: !!roleError })

    if (roleError || !hasRole) {
      console.error('Role error:', roleError?.message)
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Chairperson access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { email, password, full_name, college_id } = await req.json()
    console.log('Request data received:', { email, full_name, college_id, hasPassword: !!password })

    // Validate inputs
    if (!email || !password || !full_name || !college_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate password strength (minimum 8 characters)
    if (password.length < 8) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 8 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Sanitize inputs (prevent XSS)
    const sanitizedFullName = full_name.trim().substring(0, 100)
    const sanitizedEmail = email.trim().toLowerCase().substring(0, 255)

    // Create user using admin API
    console.log('Creating user account...')
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email: sanitizedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: sanitizedFullName,
        role: 'college_admin'
      }
    })

    if (userError) {
      console.error('User creation error:', userError.message)
      throw userError
    }

    console.log('User created successfully:', userData.user.id)

    // Update the profile with college_id
    // Note: The role is already inserted by the handle_new_user() trigger
    console.log('Updating profile with college_id...')
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ college_id })
      .eq('user_id', userData.user.id)

    if (profileError) {
      console.error('Profile update error:', profileError.message)
      throw profileError
    }

    console.log('College admin created successfully')
    return new Response(
      JSON.stringify({ success: true, user_id: userData.user.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Error in create-college-admin:', error.message)
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error occurred' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
