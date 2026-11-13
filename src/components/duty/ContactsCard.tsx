import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Save, Trash2, Users } from 'lucide-react';
import { EMPTY_PERSON, type Contacts, type PersonDetails } from '@/lib/duty/letterSettings';
import { saveContacts } from '@/lib/duty/store';

interface Props {
  sessionId: string;
  contacts: Contacts;
  onSaved: () => Promise<void>;
  onError: (e: unknown) => void;
}

function PersonRow({ label, value, onChange, onDelete }: {
  label: string;
  value: PersonDetails;
  onChange: (p: PersonDetails) => void;
  onDelete: () => void;
}) {
  const f = (key: keyof PersonDetails, text: string, type = 'text', placeholder = '') => (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{text}</Label>
      <Input type={type} value={value[key]} placeholder={placeholder} onChange={(e) => onChange({ ...value, [key]: e.target.value })} />
    </div>
  );
  return (
    <div className="rounded-md border p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Delete ${label}`} onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {f('name', 'Name (with title)', 'text', 'Dr. Anuradha Sharma')}
        {f('designation', 'Designation (optional)', 'text', 'Principal')}
        {f('college', 'College', 'text', 'L.J.C.C.A')}
        {f('phone', 'Phone', 'tel', '96382 62644')}
        {f('email', 'Email (optional)', 'email', 'name@example.com')}
      </div>
    </div>
  );
}

/**
 * Chairperson and coordinators printed on every letter. Entered once and
 * used for every exam; edit, delete or add coordinators any time. Letters
 * already made keep the names they were made with.
 */
export function ContactsCard({ sessionId, contacts, onSaved, onError }: Props) {
  const { toast } = useToast();
  const [draft, setDraft] = useState(contacts);
  const [saving, setSaving] = useState(false);

  const savedKey = JSON.stringify(contacts);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setDraft(contacts), [savedKey]);

  const dirty = JSON.stringify(draft) !== savedKey;
  const setCo = (i: number, p: PersonDetails) => setDraft({ ...draft, coordinators: draft.coordinators.map((c, j) => (j === i ? p : c)) });

  const save = async () => {
    setSaving(true);
    try {
      const clean = (p: PersonDetails): PersonDetails => ({
        name: p.name.trim(), designation: p.designation.trim(), college: p.college.trim(), phone: p.phone.trim(), email: p.email.trim(),
      });
      await saveContacts(sessionId, {
        chairperson: clean(draft.chairperson),
        coordinators: draft.coordinators.map(clean).filter((c) => c.name),
        email: draft.email.trim(),
      });
      toast({ title: 'Chairperson and coordinators saved', description: 'Used for every exam from now on. Letters already made keep the old names.' });
      await onSaved();
    } catch (e) {
      onError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Chairperson and coordinators</CardTitle>
        <CardDescription>
          Enter these once: every exam uses them, and they stay even when an exam is deleted. Edit, delete or add coordinators here any time.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <PersonRow
          label="Chairperson"
          value={draft.chairperson}
          onChange={(chairperson) => setDraft({ ...draft, chairperson })}
          onDelete={() => setDraft({ ...draft, chairperson: { ...EMPTY_PERSON } })}
        />
        {draft.coordinators.map((c, i) => (
          <PersonRow
            key={i}
            label={`Coordinator ${draft.coordinators.length > 1 ? i + 1 : ''}`.trim()}
            value={c}
            onChange={(p) => setCo(i, p)}
            onDelete={() => setDraft({ ...draft, coordinators: draft.coordinators.filter((_, j) => j !== i) })}
          />
        ))}
        <Button variant="outline" size="sm" onClick={() => setDraft({ ...draft, coordinators: [...draft.coordinators, { ...EMPTY_PERSON }] })}>
          <Plus className="mr-1 h-4 w-4" /> Add coordinator
        </Button>
        <div className="max-w-sm space-y-1">
          <Label className="text-xs text-muted-foreground">Exam email (printed under the names)</Label>
          <Input type="email" value={draft.email} placeholder="guniv.bca.exam@gmail.com" onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={!dirty || saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save
          </Button>
          {dirty && <Button variant="ghost" onClick={() => setDraft(contacts)}>Undo changes</Button>}
        </div>
      </CardContent>
    </Card>
  );
}
