// @ts-nocheck
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

  const { user_id, full_name, college_id } = await readJson(req)
  await requireCollegeAdminTarget(admin, user_id)

  const updates: Record<string, unknown> = {}
  if (typeof full_name === 'string') {
    const name = full_name.trim().substring(0, 100)
    if (!name) throw new HttpError(400, 'Full name cannot be empty')
    updates.full_name = name
  }
  if (college_id === null || college_id === '') {
    updates.college_id = null
  } else if (typeof college_id === 'string') {
    const { data: college } = await admin.from('colleges').select('id').eq('id', college_id).maybeSingle()
    if (!college) throw new HttpError(400, 'Selected college does not exist')
    updates.college_id = college_id
  }

  if (Object.keys(updates).length === 0) throw new HttpError(400, 'No valid fields to update')

  const { error } = await admin.from('profiles').update(updates).eq('user_id', user_id)
  if (error) throw new HttpError(400, error.message)

  if (updates.full_name) {
    await admin.auth.admin.updateUserById(user_id, { user_metadata: { full_name: updates.full_name } })
  }

  return json({ success: true })
}))
