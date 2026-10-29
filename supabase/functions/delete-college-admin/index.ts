// @ts-nocheck
// Deletes a college admin's auth account. The profile and role rows are
// removed by ON DELETE CASCADE; their download logs are kept (downloaded_by
// is set to NULL).
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
  const caller = await requireChairperson(req, admin)

  const { user_id } = await readJson(req)
  if (user_id === caller.id) throw new HttpError(400, 'You cannot delete your own account')
  await requireCollegeAdminTarget(admin, user_id)

  const { error } = await admin.auth.admin.deleteUser(user_id)
  if (error) throw new HttpError(400, error.message)

  return json({ success: true })
}))
