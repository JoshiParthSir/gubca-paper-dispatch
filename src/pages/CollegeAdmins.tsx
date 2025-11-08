import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Pencil, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import { z } from "zod";

const adminSchema = z.object({
  full_name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  email: z.string().trim().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  college_id: z.string().min(1, 'College is required'),
});

interface CollegeAdmin {
  user_id: string;
  email: string;
  full_name: string;
  college_id: string | null;
  college_name: string | null;
}

interface College {
  id: string;
  name: string;
  code: string;
}

export default function CollegeAdmins() {
  const [admins, setAdmins] = useState<CollegeAdmin[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<CollegeAdmin | null>(null);
  const [editFormData, setEditFormData] = useState({ full_name: "", college_id: "" });
  const [createFormData, setCreateFormData] = useState({ 
    full_name: "", 
    email: "", 
    password: "", 
    college_id: "" 
  });
  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch college admins with their college info
      const { data: adminsData, error: adminsError } = await supabase
        .from("profiles")
        .select(`
          user_id,
          email,
          full_name,
          college_id,
          colleges (
            name
          )
        `)
        .eq("role", "college_admin")
        .order("full_name");

      if (adminsError) throw adminsError;

      const formattedAdmins = adminsData.map((admin: any) => ({
        user_id: admin.user_id,
        email: admin.email,
        full_name: admin.full_name,
        college_id: admin.college_id,
        college_name: admin.colleges?.name || null,
      }));

      setAdmins(formattedAdmins);

      // Fetch colleges for the select dropdown
      const { data: collegesData, error: collegesError } = await supabase
        .from("colleges")
        .select("id, name, code")
        .order("name");

      if (collegesError) throw collegesError;
      setColleges(collegesData);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (admin: CollegeAdmin) => {
    setEditingAdmin(admin);
    setEditFormData({
      full_name: admin.full_name,
      college_id: admin.college_id || "",
    });
    setEditDialogOpen(true);
  };

  const handleResetPassword = (admin: CollegeAdmin) => {
    setEditingAdmin(admin);
    setNewPassword("");
    setResetDialogOpen(true);
  };

  const handleUpdateAdmin = async () => {
    if (!editingAdmin) return;

    try {
      setSubmitting(true);

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: editFormData.full_name,
          college_id: editFormData.college_id || null,
        })
        .eq("user_id", editingAdmin.user_id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Admin details updated successfully",
      });

      setEditDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!editingAdmin || !newPassword) return;

    if (newPassword.length < 8) {
      toast({
        title: "Error",
        description: "Password must be at least 8 characters",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { error } = await supabase.functions.invoke("reset-admin-password", {
        body: {
          user_id: editingAdmin.user_id,
          new_password: newPassword,
        },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Password reset successfully",
      });

      setResetDialogOpen(false);
      setNewPassword("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateAdmin = async () => {
    try {
      setSubmitting(true);

      // Validate form data
      const validatedData = adminSchema.parse(createFormData);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("create-college-admin", {
        body: {
          email: validatedData.email,
          password: validatedData.password,
          full_name: validatedData.full_name,
          college_id: validatedData.college_id,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Success",
        description: "College admin created successfully",
      });

      setCreateDialogOpen(false);
      setCreateFormData({ full_name: "", email: "", password: "", college_id: "" });
      fetchData();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAdmin = async (admin: CollegeAdmin) => {
    if (!confirm(`Are you sure you want to delete ${admin.full_name}?`)) return;

    try {
      setSubmitting(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Delete from profiles (which will cascade delete from user_roles due to FK)
      const { error: profileError } = await supabase
        .from("profiles")
        .delete()
        .eq("user_id", admin.user_id);

      if (profileError) throw profileError;

      // Delete the auth user (requires service role, done via edge function would be better)
      // For now, we'll just remove from profiles and user_roles
      
      toast({
        title: "Success",
        description: "College admin deleted successfully",
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-bold mb-2">College Admins Management</h1>
          <p className="text-muted-foreground">View and manage college administrator accounts</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add College Admin
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create College Admin</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="create_full_name">Full Name</Label>
                <Input
                  id="create_full_name"
                  value={createFormData.full_name}
                  onChange={(e) =>
                    setCreateFormData({ ...createFormData, full_name: e.target.value })
                  }
                  placeholder="Enter full name"
                />
              </div>
              <div>
                <Label htmlFor="create_email">Email</Label>
                <Input
                  id="create_email"
                  type="email"
                  value={createFormData.email}
                  onChange={(e) =>
                    setCreateFormData({ ...createFormData, email: e.target.value })
                  }
                  placeholder="admin@example.com"
                />
              </div>
              <div>
                <Label htmlFor="create_password">Password</Label>
                <Input
                  id="create_password"
                  type="password"
                  value={createFormData.password}
                  onChange={(e) =>
                    setCreateFormData({ ...createFormData, password: e.target.value })
                  }
                  placeholder="Minimum 8 characters"
                />
              </div>
              <div>
                <Label htmlFor="create_college">College</Label>
                <Select
                  value={createFormData.college_id}
                  onValueChange={(value) =>
                    setCreateFormData({ ...createFormData, college_id: value })
                  }
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
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreateAdmin} disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Admin
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {admins.map((admin) => (
          <Card key={admin.user_id} className="p-6">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">{admin.full_name}</h3>
                <p className="text-sm text-muted-foreground">{admin.email}</p>
                <p className="text-sm">
                  <span className="font-medium">College:</span>{" "}
                  {admin.college_name || "Not assigned"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(admin)}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleResetPassword(admin)}
                >
                  <KeyRound className="h-4 w-4 mr-2" />
                  Reset Password
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteAdmin(admin)}
                  disabled={submitting}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          </Card>
        ))}

        {admins.length === 0 && (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">No college admins found</p>
          </Card>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Admin Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                value={editFormData.full_name}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, full_name: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="college">College</Label>
              <Select
                value={editFormData.college_id}
                onValueChange={(value) =>
                  setEditFormData({ ...editFormData, college_id: value })
                }
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
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button onClick={handleUpdateAdmin} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Update
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
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Reset password for <strong>{editingAdmin?.full_name}</strong>
            </p>
            <div>
              <Label htmlFor="new_password">New Password</Label>
              <Input
                id="new_password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setResetDialogOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button onClick={handlePasswordReset} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Reset Password
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
