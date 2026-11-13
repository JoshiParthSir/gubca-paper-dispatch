# Duty Allocation – implementation plan

New feature of paperdispatch.app: practical examiner duty allocation for GU BCA.
Branch: `feature/duty-allocation`.

## The 9 rules (from the chairperson)

1. Upload the Google Form responses directly. Practical subjects come from the timetable. Faculty of that subject are preferred, **all other faculty stay as backup**.
2. **Seniors first.** No junior gets a duty until every senior has one.
3. The letter is fully customisable. It is **never regenerated** automatically; it is fixed once the chairperson finalises it.
4. If a duty is cancelled and given to someone else, that shows **only in Cancellations**, not in the allocation or edit views.
5. The letter never says what was changed (no "revised", "amended", "in place of").
6. Semester and subject names are filled in automatically from the timetable; chairperson and coordinator details are in the letter.
7. Built into paperdispatch.app (this repo).
8. Chairperson sees every PDF. A college admin sees only their college's duties and can generate / download those letters. Everything else is chairperson-only.
9. Duty Allocation is a new feature of paperdispatch.app.

---

## Status

| Phase | What | State |
|---|---|---|
| 1 | Tables + RLS, form/timetable import, name cleaning | Done (not yet applied to Supabase) |
| 2 | Allocation engine + chairperson page (Import, Faculty, Rules, Allocate) | Done (not yet tried in the browser) |
| 3 | Letters: settings, generate once, edit, finalise, PDF / ZIP, duty table export | To do |
| 4 | Edit + Cancellations, Publish, College Admin "My Duties" | To do |
| 5 | End-to-end check with real files | To do |

### Already in the repo

```
supabase/migrations/20261113120000_duty_allocation.sql   tables, triggers, RLS
src/integrations/supabase/types.ts                        duty_* types (hand-written, regenerate after push)
src/lib/duty/names.ts            name + college code cleaning
src/lib/duty/formImport.ts       Google Form responses -> subjects, colleges, faculty
src/lib/duty/timetableImport.ts  timetable rows, date parsing, centre matching
src/lib/duty/pools.ts            subject / other practical / backup tiers
src/lib/duty/allocate.ts         allocation engine, buildSlots, checkDuty
src/lib/duty/readSheet.ts        xlsx/csv reading (SheetJS, lazy-loaded), template download
src/lib/duty/store.ts            all Supabase reads/writes for the feature
src/components/duty/*.tsx        ImportTab, FacultyTab, RulesTab, AllocateTab, shared, lookups
src/pages/DutyAllocation.tsx     chairperson page, route /dashboard/duty-allocation
src/lib/duty/*.test.ts           25 tests (npm test)
```

Tables: `duty_sessions`, `duty_subjects`, `duty_college_data`, `duty_faculty`, `duty_timetable`, `duty_assignments`, `duty_letters`.
Key facts:
- `duty_assignments.status` is `active` or `cancelled`; cancelled rows keep `replaced_by`, `cancel_reason`, `cancelled_at`, `cancelled_by`.
- A unique index allows only one **active** duty per examiner per day.
- A trigger blocks changing `duty_letters.content` while `finalised_at` is set.
- College admin can read only when `duty_sessions.status = 'published'`, and only their own scope (see the RLS section of the migration).

---

## Step 0 – before anything else

1. Apply the migration:
   ```bash
   npx supabase link --project-ref <your project ref>
   npx supabase db push
   ```
2. Regenerate the types so they match the real database:
   ```bash
   npx supabase gen types typescript --project-id <your project ref> > src/integrations/supabase/types.ts
   ```
   Then `npx tsc -p tsconfig.app.json --noEmit` must still pass.
3. `npm run dev`, sign in as chairperson, open **Examinations → Duty Allocation**:
   - New exam → Import the form file → Save.
   - Import the timetable → confirm the 4 "Check" centres (CCCA→AAKMS, KHYATI→KHYATIBCA, UMIYABCA→UCCA, PRSTDBCA→PRSDTBCA) → Save.
   - Faculty tab: mark seniors.
   - Allocate → Run → Save.
   If anything fails here, fix it before Phase 3.

Open decisions (defaults used so far, change if needed):
- Seniors are marked by the chairperson in the Faculty tab (the form has no seniority column). Option: add a "Designation / years of experience" question to the form next time.
- College admin sees both: duties of their own faculty, and examiners coming to their college as a centre.
- Visiting faculty are allowed (Rules → "Visiting faculty can get duties").
- AAKMS and CCCA are treated as separate colleges.

---

## Phase 3 – Letters

### 3.1 Letter settings (stored in `duty_sessions.letter_settings`)

Create `src/lib/duty/letterSettings.ts`:

```ts
export interface PersonDetails { name: string; designation: string; college: string; phone: string; email: string }

export interface LetterSettings {
  semesterLabel: string;      // "Semester V"   (auto, editable)
  examMonth: string;          // "November - 2026" (auto from timetable dates, editable)
  issueDate: string;          // date printed on the letter
  refPrefix: string;          // e.g. "GU/BCA/PR/2026/" – letter number = prefix + running number
  ratePerStudent: number;     // remuneration per student (Rs.)
  billLastDate: string;
  chairperson: PersonDetails;
  coordinator: PersonDetails;
  collegeFullNames: Record<string, string>;   // college code -> full name for letters
  template: {
    subjectLine: string;      // with placeholders
    opening: string;          // paragraph before the duty table
    guidelines: string[];     // numbered list after the table
    closing: string;
  };
}
export function readLetterSettings(session): LetterSettings   // defaults + stored values
export const DEFAULT_TEMPLATE: LetterSettings['template']
```

Auto-fill (rule 6):
- **Subject names**: `duty_subjects.name` (from the form headers, e.g. "Practical Solutions Using Python"). Only codes present in `duty_timetable` go in the letter.
- **Semester**: from the subject code number, `353 -> 5` (`Math.floor(n / 10) % 10`). Confirm this matches GU codes for other semesters; it is only a default and stays editable.
- **Exam month**: month + year of the earliest timetable date, e.g. "November - 2026".
- **College full names**: start from `colleges.name` when `duty_college_data.college_id` is linked, else the form's `raw_name`. Editable in the settings screen.
- **Chairperson**: default from the signed-in chairperson's `profiles.full_name`; the rest is typed once and saved per session (copy from the previous session when creating a new one).

Placeholders (keep the list small and documented in the UI):
`{{title}} {{name}} {{college}} {{semester}} {{examMonth}} {{subjects}} {{rate}} {{billLastDate}} {{chairperson.name}} {{coordinator.name}} {{coordinator.phone}} {{coordinator.email}}`

### 3.2 Letter content (stored in `duty_letters.content`)

`src/lib/duty/letter.ts`:

```ts
export interface LetterDutyRow { date: string; centreCode: string; centreName: string; subject: string; students: number; batches: number }

export interface LetterContent {
  refNo: string;
  issueDate: string;
  to: { title: string; name: string; college: string };
  subjectLine: string;
  opening: string;
  duties: LetterDutyRow[];
  guidelines: string[];
  closing: string;
  signatory: PersonDetails;        // chairperson
  coordinator: PersonDetails;
}

/** Build a fresh letter from the template. Pure function, unit-test it. */
export function buildLetter(faculty, duties, settings, lookups, refNo): LetterContent
```

Rules:
- **Generate once (rule 3).** "Generate letters" creates a row only for examiners who have active duties and **no letter yet**. Existing letters are never overwritten.
- Each letter is editable field by field (subject line, paragraphs, each guideline, duty rows). Save writes `content` only.
- "Reset to template" exists per letter, only while not finalised, behind a confirm dialog. This is the only way to rebuild a letter.
- **Finalise** sets `finalised_at` + `finalised_by`. The database trigger then blocks edits. "Un-finalise" clears `finalised_at` (chairperson only, confirm dialog).
- **No change wording (rule 5).** `buildLetter` never mentions replacement or revision. Review the default template text for words like "revised", "in place of", "instead of", "change".
- Letter number: assign once at generation (`refPrefix` + running number); never renumber.

Store functions to add in `store.ts`:
`saveLetterSettings`, `listLetters(sessionId)`, `createLetters(sessionId, contents[])` (insert, `onConflict: 'session_id,faculty_id'`, `ignoreDuplicates: true`), `updateLetterContent(id, content)`, `setFinalised(id, boolean)`.

### 3.3 PDF, ZIP and duty table

Install (bundled; the site CSP blocks CDN scripts):
```bash
npm install jspdf jspdf-autotable jszip
```
`src/lib/duty/pdf.ts` – load the libraries with `await import(...)` like `readSheet.ts`, so they stay out of the main bundle:
- `renderLetterPdf(content): Promise<Blob>` – A4, built-in Helvetica, header, ref no + date, To block, subject line, opening, duty table (autotable), numbered guidelines, closing, signature block, coordinator contact line.
- `lettersZip(letters): Promise<Blob>` – one PDF per examiner, file name `<COLLEGE>_<Name_Surname>.pdf`. Add `_2`, `_3` when two names clash; the edumark tool used first names only and could overwrite files.
- `allLettersPdf(letters): Promise<Blob>` – one PDF, one letter per page, for printing.
- `dutyTablePdf(...)` and `dutyTableXlsx(...)` – centre-wise / date-wise table of active duties (the Excel uses SheetJS, already installed).

Preview: the CSP has `frame-src 'none'` and `object-src 'none'`, so **do not embed PDFs in an iframe**. Show an HTML preview built from the same `LetterContent`, and open the PDF with `URL.createObjectURL(blob)` + `window.open` or a download link.

### 3.4 Letters tab (chairperson)

New tab `5. Letters` in `DutyAllocation.tsx` → `src/components/duty/LettersTab.tsx`:
- Settings card (3.1) with Save.
- "Generate letters" button + count of examiners without a letter.
- List: examiner, college, duties, status (Draft / Finalised), actions: Preview, Edit, Finalise / Un-finalise, Download PDF.
- Bulk: "Finalise all drafts", "Download all (ZIP)", "All letters in one PDF", "Duty table PDF", "Duty table Excel".
- A warning list for letters whose duties no longer match the active duties (see 4.2).

Tests: `letter.test.ts` for `buildLetter` (placeholders filled, only active duties, no change words, subjects from the timetable).

---

## Phase 4 – Edit, Cancellations, Publish, College Admin

### 4.1 Edit (before publishing)

In the Allocate tab, each examiner line gets **Change**:
- The picker lists eligible faculty for that seat, ranked like the engine (teaches it → other practical → backup, then fewest duties). Use `checkDuty()` from `allocate.ts` to show why someone is not allowed. The chairperson may override (e.g. own college) only after a confirm.
- Before publishing, a change simply updates `faculty_id` on the active row. No history needed.

### 4.2 Cancellations (rule 4)

Do it in one database call so it cannot half-fail. New migration with a function:

```sql
create function public.duty_cancel_and_replace(_assignment uuid, _new_faculty uuid, _reason text)
returns uuid  -- id of the new duty
language plpgsql security invoker set search_path = public as $$ ... $$;
-- 1. check the caller is chairperson (duty_is_chair())
-- 2. update the old row: status='cancelled', cancelled_at=now(), cancelled_by=auth.uid(), cancel_reason=_reason
-- 3. insert the new active row (same date, centre, subject, seat_role)
-- 4. set replaced_by on the old row
```
(Allow `_new_faculty` null for "cancel only".)

UI:
- Allocate / Edit views read **only `status = 'active'`** (already the case in `AllocateTab`). The replacement looks like a normal duty.
- New tab `6. Cancellations`: table of cancelled duties – date, centre, subject, original examiner, reason, replaced by, when, by whom. This is the only place a cancellation appears.

Letters after a cancellation:
- The **new** examiner gets a normal letter from "Generate letters" (it only creates missing ones). It says nothing about a replacement (rule 5).
- The **cancelled** examiner's letter still lists the old duty. Do not rebuild it automatically (rule 3). Show it in the Letters tab warning list ("duties changed"). The chairperson un-finalises it, removes the row (or deletes the letter if no duty is left), and finalises again. Nothing in the letter mentions the change.
- College admin RLS already shows only active duties and finalised letters.

### 4.3 Publish

- Session header: **Publish** (chairperson). Enabled only when every examiner with an active duty has a finalised letter. Sets `status = 'published'`, `published_at = now()`.
- **Unpublish** sets it back to `draft` (college admins lose access until published again).
- `updateSession` in `store.ts` needs `status` / `published_at` in its allowed fields.

### 4.4 College Admin – "My Duties" (rule 8)

- `src/pages/MyDuties.tsx`, route `/dashboard/my-duties`, add to `collegeAdminNav` (Examinations group) and the mobile tabs if there is room.
- Data (RLS does the filtering; no extra checks needed in the client, but do not show anything the query did not return):
  - published sessions,
  - `duty_assignments` (active only) joined in code with `duty_faculty`, `duty_college_data`, `duty_subjects`,
  - `duty_letters` (finalised, own faculty only).
- Sections:
  1. **Our faculty's duties** – examiner, date, centre, subject; buttons Download PDF / Download all (ZIP).
  2. **Examiners coming to our college** – date, subject, examiner, their college (so the centre can prepare).
- PDFs are generated in the browser from `content` with the Phase 3 functions. Admins cannot edit anything.
- Optional: log letter downloads (like `download_logs`) so the chairperson can see who downloaded.

### 4.5 RLS test checklist (do this with two real accounts)

- [ ] College admin sees nothing while the session is `draft`.
- [ ] After publish: sees own faculty's duties + duties at own centre, nothing else.
- [ ] Cannot see cancelled rows.
- [ ] Cannot see draft (not finalised) letters, or other colleges' letters.
- [ ] Every insert / update / delete from the admin account fails.
- [ ] Chairperson cannot edit a finalised letter without un-finalising first (trigger).
- [ ] Two active duties for one examiner on one date is refused (unique index).

---

## Phase 5 – end-to-end check

With `NEP_GUBCA_sem5_Data_september26 (Responses).xlsx` and `BCA_Sem5_Practical_Timetable_Nov2026.xlsx`:
1. Import both; the 4 centre links are confirmed.
2. Mark real seniors; run; every senior has a duty before any junior; no unfilled seats.
3. Generate letters → edit one → finalise all → download ZIP and the single PDF; check subject names, semester, exam month, chairperson and coordinator details.
4. Cancel one duty with a replacement: the Allocate view shows only the new examiner; Cancellations shows the history; the new letter has no change wording.
5. Publish; sign in as a college admin; check 4.5.
6. `npm test`, `npx tsc -p tsconfig.app.json --noEmit`, `npm run lint`, `npm run build` all pass.

## Known data issues in the current form file

- LJCCA: "PROF. PUNAM MA'AM" – full name needed.
- NAVGUJBCA: 352T and 353P say only "Visiting" – no named faculty, so no 353P subject teacher there.
- KIBCA: SEC-356 is "NA".
- No seniority, phone or per-faculty email in the form. Add these questions next time if possible.

## Repo housekeeping (separate small PR)

- Remove stray files: `app.use(express.js`, `const express = require('express');.js`, `Untitled-1.json`, `test-output.txt`.
- Stop tracking `.env` (`git rm --cached .env`), keep `.env.example`. It holds only the publishable key, so this is tidiness, not a leak.
