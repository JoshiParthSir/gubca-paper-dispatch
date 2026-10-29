// @ts-nocheck
// Deletes paper PDFs from temporary storage once they expire
// (papers.expires_at = last exam end + retention period, maintained by a DB
// trigger). Runs hourly via pg_cron and is also triggered from the Papers page.
//
// No auth is required: it only ever removes files that are already past their
// expiry, so calling it early or repeatedly is harmless.
import { adminClient, handler, json } from '../_shared/utils.ts'

const BATCH_SIZE = 500

Deno.serve(handler(async () => {
  const admin = adminClient()

  const { data: expired, error } = await admin
    .from('papers')
    .select('id, file_path')
    .not('file_path', 'is', null)
    .lte('expires_at', new Date().toISOString())
    .limit(BATCH_SIZE)
  if (error) throw error

  if (!expired || expired.length === 0) return json({ success: true, purged: 0 })

  const { error: removeError } = await admin.storage
    .from('papers')
    .remove(expired.map((p) => p.file_path))
  if (removeError) throw removeError

  const { error: updateError } = await admin
    .from('papers')
    .update({ file_path: null, purged_at: new Date().toISOString() })
    .in('id', expired.map((p) => p.id))
  if (updateError) throw updateError

  console.log(`Purged ${expired.length} expired paper file(s)`)
  return json({ success: true, purged: expired.length })
}))
