// @ts-nocheck
// Sets a new temporary password for a college admin. They must change it
// at their next login.
import {
  HttpError,
  adminClient,
  handler,
  json,
  readJson,
  requireChairperson,
  requireCollegeAdminTarget,
} from '../_shared/utils.ts'

Deno.serve(handler(async (req) => {
  const admin = adminClient()
  await requireChairperson(req, admin)

  const { user_id, new_password } = await readJson(req)
  await requireCollegeAdminTarget(admin, user_id)

  if (typeof new_password !== 'string' || new_password.length < 8) {
    throw new HttpError(400, 'Password must be at least 8 characters')
  }

  const { error } = await admin.auth.admin.updateUserById(user_id, {
    password: new_password,
    email_confirm: true,
  })
  if (error) throw new HttpError(400, error.message)

  // Set after the password update: the password-change trigger clears the flag.
  const { error: flagError } = await admin
    .from('profiles')
    .update({ must_change_password: true })
    .eq('user_id', user_id)
  if (flagError) throw new HttpError(500, flagError.message)

  return json({ success: true, message: 'Password reset successfully' })
}))
