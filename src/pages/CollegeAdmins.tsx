import { useState, useEffect, useMemo } from "react";
import { hasCached, useCachedState } from '@/lib/page-cache';
import { PageSkeleton } from '@/components/PageFallback';
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { callEdgeFunction } from "@/lib/edge";
import { EMAIL_REGEX } from "@/lib/validation";
import { generatePassword, MIN_PASSWORD_LENGTH } from "@/lib/password";
import { BulkImportDialog } from "@/components/BulkImportDialog";
import { Pencil, KeyRound, Loader2, Trash, Plus, Copy, Upload, RefreshCw, ShieldAlert } from "lucide-react";

interface CollegeAdmin {
  user_id: string;
  email: string;
  full_name: string;
  college_id: string | null;
  college_name: string | null;
  must_change_password: boolean;
}

interface College {
  id: string;
  name: string;
  code: string;
}

interface CreateResponse {
  success: boolean;
  user_id: string;
  email: string;
  temporary_password: string;
}

interface Credentials {
  title: string;
  name: string;
  email: string;
  password: string;
}

const emptyCreateForm = () => ({ full_name: "", email: "", college_id: "", password: generatePassword() });

function loginDetailsText(c: Credentials) {
  return [
    `Paper Dispatch login for ${c.name}`,
    `Website: ${window.location.origin}/auth`,
    `Email: ${c.email}`,
    `Temporary password: ${c.password}`,
    `You will be asked to set your own password after signing in.`,
  ].join("\n");
}

function PasswordField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex gap-2">
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="font-mono"
        autoComplete="off"
        spellCheck={false}
      />
      <Button type="button" variant="outline" size="icon" title="Generate new password" onClick={() => onChange(generatePassword())}>
        <RefreshCw className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function CollegeAdmins() {
  const [admins, setAdmins] = useCachedState<CollegeAdmin[]>('collegeadmins:admins', []);
  const [colleges, setColleges] = useCachedState<College[]>('collegeadmins:colleges', []);
  // Only the first visit shows a skeleton; later visits render cached data instantly
  const [loading, setLoading] = useState(!hasCached('collegeadmins:admins'));
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<CollegeAdmin | null>(null);
  const [editFormData, setEditFormData] = useState({ full_name: "", college_id: "" });
  const [createFormData, setCreateFormData] = useState(emptyCreateForm);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const showError = (error: unknown, fallback: string) => {
    toast({
      title: "Error",
      description: error instanceof Error ? error.message : fallback,
      variant: "destructive",
    });
  };

  const fetchData = async () => {
    try {
      const [collegesRes, adminsRes] = await Promise.all([
        supabase.from("colleges").select("id, name, code").order("name"),
        supabase
          .from("profiles")
          .select("user_id, email, full_name, college_id, must_change_password, colleges (name)")
          .eq("role", "college_admin")
          .order("full_name"),
      ]);

      if (collegesRes.error) throw collegesRes.error;
      if (adminsRes.error) throw adminsRes.error;

      setColleges(collegesRes.data || []);
      setAdmins(
        (adminsRes.data || []).map((admin: any) => ({
          user_id: admin.user_id,
          email: admin.email,
          full_name: admin.full_name,
          college_id: admin.college_id,
          college_name: admin.colleges?.name || null,
          must_change_password: !!admin.must_change_password,
        })),
      );
      setSelected(new Set());
    } catch (error) {
      showError(error, "Failed to load admins");
    } finally {
      setLoading(false);
    }
  };

  const filteredAdmins = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return admins;
    return admins.filter((a) =>
      [a.full_name, a.email, a.college_name ?? ""].some((v) => v.toLowerCase().includes(q)),
    );
  }, [admins, search]);

  const collegesByCode = useMemo(
    () => new Map(colleges.map((c) => [c.code.trim().toLowerCase(), c])),
    [colleges],
  );

  const handleCreateAdmin = async () => {
    const full_name = createFormData.full_name.trim();
    const email = createFormData.email.trim().toLowerCase();
    const password = createFormData.password.trim();

    if (!full_name || !email || !createFormData.college_id) {
      toast({ title: "Error", description: "Full name, email and college are required", variant: "destructive" });
      return;
    }
    if (!EMAIL_REGEX.test(email)) {
      toast({ title: "Error", description: "Please enter a valid email address", variant: "destructive" });
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      toast({
        title: "Error",
        description: `Temporary password must be at least ${MIN_PASSWORD_LENGTH} characters`,
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);
      const result = await callEdgeFunction<CreateResponse>("create-college-admin", {
        email,
        full_name,
        college_id: createFormData.college_id,
        password,
      });
      setCreateDialogOpen(false);
      setCreateFormData(emptyCreateForm());
      setCredentials({ title: "Admin account created", name: full_name, email, password: result.temporary_password });
      fetchData();
    } catch (error) {
      showError(error, "Failed to create admin");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateAdmin = async () => {
    if (!editingAdmin) return;
    if (!editFormData.full_name.trim()) {
      toast({ title: "Error", description: "Full name is required", variant: "destructive" });
      return;
    }

    try {
      setSubmitting(true);
      await callEdgeFunction("update-college-admin", {
        user_id: editingAdmin.user_id,
        full_name: editFormData.full_name,
        college_id: editFormData.college_id || null,
      });
      toast({ title: "Success", description: "Admin details updated" });
      setEditDialogOpen(false);
      fetchData();
    } catch (error) {
      showError(error, "Failed to update admin");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!editingAdmin) return;
    const password = newPassword.trim();
    if (password.length < MIN_PASSWORD_LENGTH) {
      toast({
        title: "Error",
        description: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);
      await callEdgeFunction("reset-admin-password", {
        user_id: editingAdmin.user_id,
        new_password: password,
      });
      setResetDialogOpen(false);
      setCredentials({
        title: "Password reset",
        name: editingAdmin.full_name,
        email: editingAdmin.email,
        password,
      });
      setNewPassword("");
      fetchData();
    } catch (error) {
      showError(error, "Failed to reset password");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteAdmins = async (ids: string[]) => {
    const label = ids.length === 1 ? "this admin" : `${ids.length} admins`;
    if (!confirm(`Delete ${label}? Their login will be removed permanently.`)) return;

    setSubmitting(true);
    const failures: string[] = [];
    for (const user_id of ids) {
      try {
        await callEdgeFunction("delete-college-admin", { user_id });
      } catch (error) {
        const admin = admins.find((a) => a.user_id === user_id);
        failures.push(`${admin?.email ?? user_id}: ${error instanceof Error ? error.message : "failed"}`);
      }
    }
    setSubmitting(false);

    if (failures.length) {
      toast({
        title: `${ids.length - failures.length} deleted, ${failures.length} failed`,
        description: failures.join("\n"),
        variant: "destructive",
      });
    } else {
      toast({ title: "Success", description: `Deleted ${label}` });
    }
    fetchData();
  };

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allVisibleSelected = filteredAdmins.length > 0 && filteredAdmins.every((a) => selected.has(a.user_id));

  const copy = async (text: string, what: string) => {
    await navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: `${what} copied to clipboard` });
  };

  if (loading) {
    return <PageSkeleton cards={4} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1>College Admins</h1>
          <p className="text-muted-foreground">Create admin logins and share the details with each college</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setBulkOpen(true)}>
            <Upload className="h-4 w-4" />
            Bulk Create
          </Button>
          <Button
            onClick={() => {
              setCreateFormData(emptyCreateForm());
              setCreateDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add Admin
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search by name, email or college"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:max-w-sm"
        />
        {filteredAdmins.length > 0 && (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={allVisibleSelected}
              onCheckedChange={(checked) =>
                setSelected(checked ? new Set(filteredAdmins.map((a) => a.user_id)) : new Set())
              }
            />
            Select all
          </label>
        )}
        {selected.size > 0 && (
          <Button variant="destructive" size="sm" disabled={submitting} onClick={() => deleteAdmins([...selected])}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash className="h-4 w-4" />}
            Delete {selected.size} selected
          </Button>
        )}
      </div>

      <div className="stagger grid gap-4">
        {filteredAdmins.map((admin) => (
          <Card key={admin.user_id} className="p-5">
            <div className="flex flex-wrap justify-between items-start gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <Checkbox
                  className="mt-1.5"
                  checked={selected.has(admin.user_id)}
                  onCheckedChange={() => toggleSelected(admin.user_id)}
                />
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-bold">{admin.full_name}</h3>
                    {admin.must_change_password ? (
                      <Badge variant="secondary" className="gap-1">
                        <ShieldAlert className="h-3 w-3" />
                        Temporary password
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-success/30 text-success">
                        Active
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-sm text-muted-foreground">{admin.email}</p>
                  <p className="text-sm">
                    <span className="font-medium">College:</span> {admin.college_name || "Not assigned"}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingAdmin(admin);
                    setEditFormData({ full_name: admin.full_name, college_id: admin.college_id || "" });
                    setEditDialogOpen(true);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingAdmin(admin);
                    setNewPassword(generatePassword());
                    setResetDialogOpen(true);
                  }}
                >
                  <KeyRound className="h-4 w-4" />
                  Reset Password
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={submitting}
                  onClick={() => deleteAdmins([admin.user_id])}
                  className="hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          </Card>
        ))}

        {filteredAdmins.length === 0 && (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">
              {admins.length === 0 ? "No college admins yet" : "No admins match your search"}
            </p>
          </Card>
        )}
      </div>

      {/* Create Admin Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add College Admin</DialogTitle>
            <DialogDescription>
              The admin signs in with this temporary password and must set their own on first login.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="create_full_name">Full name</Label>
              <Input
                id="create_full_name"
                placeholder="Enter full name"
                value={createFormData.full_name}
                onChange={(e) => setCreateFormData({ ...createFormData, full_name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create_email">Email (used as login ID)</Label>
              <Input
                id="create_email"
                type="email"
                placeholder="name@college.edu"
                value={createFormData.email}
                onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>College</Label>
              <Select
                value={createFormData.college_id}
                onValueChange={(value) => setCreateFormData({ ...createFormData, college_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a college" />
                </SelectTrigger>
                <SelectContent>
                  {colleges.map((college) => (
                    <SelectItem key={college.id} value={college.id}>
                      {college.name} ({college.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create_password">Temporary password</Label>
              <PasswordField
                id="create_password"
                value={createFormData.password}
                onChange={(password) => setCreateFormData({ ...createFormData, password })}
              />
            </div>
            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button onClick={handleCreateAdmin} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Create Admin
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Login details (after create / reset) */}
      <Dialog open={!!credentials} onOpenChange={(open) => !open && setCredentials(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{credentials?.title}</DialogTitle>
            <DialogDescription>
              Share these login details with {credentials?.name}. The password is shown only now.
            </DialogDescription>
          </DialogHeader>
          {credentials && (
            <div className="space-y-3">
              <div className="rounded-xl border bg-secondary/60 p-4">
                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="eyebrow">Login email</dt>
                    <dd className="mt-0.5 flex items-center justify-between gap-2 font-medium">
                      <span className="truncate">{credentials.email}</span>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copy(credentials.email, "Email")}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </dd>
                  </div>
                  <div>
                    <dt className="eyebrow">Temporary password</dt>
                    <dd className="mt-0.5 flex items-center justify-between gap-2">
                      <span className="font-mono text-lg font-semibold tracking-wider text-primary">
                        {credentials.password}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => copy(credentials.password, "Password")}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </dd>
                  </div>
                </dl>
              </div>
              <p className="text-xs text-muted-foreground">
                They will be asked to choose their own password the first time they sign in.
              </p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={() => setCredentials(null)}>
                  Done
                </Button>
                <Button variant="gold" onClick={() => copy(loginDetailsText(credentials), "Login details")}>
                  <Copy className="h-4 w-4" />
                  Copy login details
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Admin Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Full name</Label>
              <Input
                id="full_name"
                value={editFormData.full_name}
                onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>College</Label>
              <Select
                value={editFormData.college_id}
                onValueChange={(value) => setEditFormData({ ...editFormData, college_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select college" />
                </SelectTrigger>
                <SelectContent>
                  {colleges.map((college) => (
                    <SelectItem key={college.id} value={college.id}>
                      {college.name} ({college.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button onClick={handleUpdateAdmin} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Save changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Give <strong>{editingAdmin?.full_name}</strong> a new temporary password. They must change it at their
              next sign-in.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new_password">New temporary password</Label>
              <PasswordField id="new_password" value={newPassword} onChange={setNewPassword} />
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setResetDialogOpen(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button onClick={handlePasswordReset} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Reset Password
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <BulkImportDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        title="Bulk Create College Admins"
        description="Creates a login for each row. Leave password empty to generate one. Download the results afterwards: it is the only copy of the temporary passwords."
        templateFileName="college-admins-template.csv"
        columns={[
          { key: "full_name", required: true },
          { key: "email", required: true },
          { key: "college_code", required: true, hint: "must match a code on the Colleges page" },
          { key: "password", hint: `optional, min ${MIN_PASSWORD_LENGTH} characters; generated if empty` },
        ]}
        sampleRows={[["Asha Patel", "asha.patel@example.com", colleges[0]?.code ?? "COL001", ""]]}
        concurrency={3}
        validateRow={(row, i, all) => {
          const email = row.email.toLowerCase();
          if (!EMAIL_REGEX.test(email)) return "Invalid email";
          if (!collegesByCode.has(row.college_code.toLowerCase())) return `Unknown college code "${row.college_code}"`;
          if (row.password && row.password.length < MIN_PASSWORD_LENGTH) {
            return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
          }
          if (admins.some((a) => a.email.toLowerCase() === email)) return "Admin already exists";
          if (all.findIndex((r) => r.email?.toLowerCase() === email) !== i) return "Duplicate email in file";
          return null;
        }}
        processRow={async (row) => {
          const result = await callEdgeFunction<CreateResponse>("create-college-admin", {
            email: row.email.toLowerCase(),
            full_name: row.full_name,
            college_id: collegesByCode.get(row.college_code.toLowerCase())!.id,
            password: row.password || generatePassword(),
          });
          return `Temporary password: ${result.temporary_password}`;
        }}
        onComplete={fetchData}
      />
    </div>
  );
}
