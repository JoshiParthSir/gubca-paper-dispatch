// @ts-nocheck
// Creates a college admin account with a temporary password. No email is
// sent: the chairperson shares the login details directly. The admin must
// change the password on first login (profiles.must_change_password).
import {
  EMAIL_REGEX,
  HttpError,
  adminClient,
  handler,
  json,
  readJson,
  requireChairperson,
} from '../_shared/utils.ts'

// No look-alike characters (0/O, 1/l/I) so passwords are easy to read out.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'

function generatePassword(length = 10) {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}

Deno.serve(handler(async (req) => {
  const admin = adminClient()
  await requireChairperson(req, admin)

  const body = await readJson(req)
  const email = String(body.email ?? '').trim().toLowerCase().substring(0, 255)
  const fullName = String(body.full_name ?? '').trim().substring(0, 100)
  const collegeId = body.college_id ? String(body.college_id) : ''
  const providedPassword = typeof body.password === 'string' ? body.password.trim() : ''

  if (!email || !EMAIL_REGEX.test(email)) throw new HttpError(400, 'A valid email is required')
  if (!fullName) throw new HttpError(400, 'Full name is required')
  if (!collegeId) throw new HttpError(400, 'College is required')
  if (providedPassword && providedPassword.length < 8) {
    throw new HttpError(400, 'Temporary password must be at least 8 characters')
  }

  const { data: college, error: collegeError } = await admin
    .from('colleges')
    .select('id')
    .eq('id', collegeId)
    .maybeSingle()
  if (collegeError) throw new HttpError(500, collegeError.message)
  if (!college) throw new HttpError(400, 'Selected college does not exist')

  const { data: existing } = await admin.from('profiles').select('user_id').eq('email', email).maybeSingle()
  if (existing) throw new HttpError(409, 'An account with this email already exists')

  const password = providedPassword || generatePassword()

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (createError) {
    const msg = /already.*registered|already exists/i.test(createError.message)
      ? 'An account with this email already exists'
      : createError.message
    throw new HttpError(400, msg)
  }

  const userId = created.user.id

  // The handle_new_user() trigger created the profile and college_admin role.
  const { error: profileError } = await admin
    .from('profiles')
    .update({ college_id: collegeId, full_name: fullName, must_change_password: true })
    .eq('user_id', userId)
  if (profileError) {
    await admin.auth.admin.deleteUser(userId)
    throw new HttpError(500, `Could not set up the profile: ${profileError.message}`)
  }

  return json({ success: true, user_id: userId, email, temporary_password: password })
}))
