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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Pencil, KeyRound, Loader2, Trash, Plus, Copy } from "lucide-react";

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
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<CollegeAdmin | null>(null);
  const [editFormData, setEditFormData] = useState({ full_name: "", college_id: "" });
  const [createFormData, setCreateFormData] = useState({ 
    full_name: "", 
    email: "", 
    college_id: "" 
  });
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const { user, profile } = useAuth();

  useEffect(() => {
    fetchData();
    checkUserRole();
  }, [user]);

  const checkUserRole = async () => {
    if (!user) return;
    
    try {
      // Check if user has chairperson role in user_roles table
      const { data: userRoles, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      console.log("Current user roles:", userRoles);
      console.log("Current user profile:", profile);
      
      // Test the check_user_role function directly
      const { data: roleCheckResult, error: roleCheckError } = await supabase
        .rpc('check_user_role', { _user_id: user.id, _role: 'chairperson' });
      
      console.log("Role check function result:", roleCheckResult);
      console.log("Role check function error:", roleCheckError);
      
      toast({
        title: "Debug Info",
        description: `Roles: ${userRoles?.map(r => r.role).join(', ') || 'None'}, Chairperson check: ${roleCheckResult}`,
      });
      
      if (error) {
        console.error("Error checking user roles:", error);
      }
    } catch (error) {
      console.error("Error in checkUserRole:", error);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const { data: collegesData, error: collegesError } = await supabase
        .from("colleges")
        .select("id, name, code")
        .order("name");

      if (collegesError) throw collegesError;
      setColleges(collegesData || []);

      const { data: adminsData, error: adminsError } = await supabase
        .from("profiles")
        .select(`user_id, email, full_name, college_id, colleges (name)`)
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

  const handleCreateAdmin = async () => {
    try {
      setSubmitting(true);

      // Validate all required fields
      if (!createFormData.full_name.trim()) {
        toast({
          title: "Error",
          description: "Full name is required",
          variant: "destructive",
        });
        return;
      }

      if (!createFormData.email.trim()) {
        toast({
          title: "Error",
          description: "Email is required",
          variant: "destructive",
        });
        return;
      }


      if (!createFormData.college_id) {
        toast({
          title: "Error",
          description: "College selection is required",
          variant: "destructive",
        });
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(createFormData.email)) {
        toast({
          title: "Error",
          description: "Please enter a valid email address",
          variant: "destructive",
        });
        return;
      }

      // Validate password length
      if (createFormData.password.length < 8) {
        toast({
          title: "Error",
          description: "Password must be at least 8 characters",
          variant: "destructive",
        });
        return;
      }

      // Check if email already exists
      const { data: existingUser, error: checkError } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", createFormData.email.toLowerCase())
        .maybeSingle();

      if (checkError && checkError.code !== "PGRST116") {
        throw checkError;
      }

      if (existingUser) {
        toast({
          title: "Error",
          description: "An admin with this email already exists",
          variant: "destructive",
        });
        return;
      }

      // Create auth user and profile via edge function
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const { data, error } = await supabase.functions.invoke("create-college-admin", {
        body: {
          email: createFormData.email.toLowerCase(),
          password: createFormData.password,
          full_name: createFormData.full_name,
          college_id: createFormData.college_id,
        },
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });

      if (error) {
        console.error("Edge function error:", error);
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Success",
        description: "Admin created successfully and assigned to college",
      });

      // Reset form and close dialog
      setCreateFormData({ full_name: "", email: "", password: "", college_id: "" });
      setCreateDialogOpen(false);
      
      // Refresh admin list
      fetchData();
    } catch (error: any) {
      console.error("Create admin error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create admin",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateAdmin = async () => {
    if (!editingAdmin) return;

    try {
      setSubmitting(true);

      // Validate required fields
      if (!editFormData.full_name.trim()) {
        toast({
          title: "Error",
          description: "Full name is required",
          variant: "destructive",
        });
        return;
      }

      // Use an edge function to safely update another user's profile
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      if (!accessToken) {
        toast({
          title: "Error",
          description: "Authentication required. Please log in again.",
          variant: "destructive",
        });
        return;
      }

      console.log("Updating admin:", {
        user_id: editingAdmin.user_id,
        full_name: editFormData.full_name,
        college_id: editFormData.college_id || null,
      });

      const { data, error } = await supabase.functions.invoke("update-college-admin", {
        body: {
          user_id: editingAdmin.user_id,
          full_name: editFormData.full_name,
          college_id: editFormData.college_id || null,
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      console.log("Edge function response:", { data, error });

      if (error) {
        console.error("Edge function error:", error);
        throw new Error(`Failed to send request to edge function: ${error.message}`);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Success",
        description: "Admin details updated successfully",
      });

      setEditDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Update admin error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update admin details",
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

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const { data, error } = await supabase.functions.invoke("reset-admin-password", {
        body: {
          user_id: editingAdmin.user_id,
          new_password: newPassword,
        },
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

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

  const handleDeleteAdmin = async (user_id: string) => {
    if (!confirm("Are you sure you want to delete this admin?")) return;

    try {
      setSubmitting(true);

      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("user_id", user_id);

      if (error) throw error;

      toast({ title: "Success", description: "Admin deleted successfully" });
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
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-2">College Admins Management</h1>
          <p className="text-muted-foreground">View and manage college administrator accounts</p>
          {profile && (
            <p className="text-sm text-muted-foreground mt-1">
              Current user: {profile.full_name} ({profile.role})
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={checkUserRole}>
            Debug Role
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Admin
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {admins.map((admin) => (
          <Card key={admin.user_id} className="p-6">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">{admin.full_name}</h3>
                <p className="text-sm text-muted-foreground">{admin.email}</p>
                <p className="text-sm">
                  <span className="font-medium">College:</span> {admin.college_name || "Not assigned"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handleEdit(admin)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleResetPassword(admin)}>
                  <KeyRound className="h-4 w-4 mr-2" />
                  Reset Password
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDeleteAdmin(admin.user_id)}>
                  <Trash className="h-4 w-4 mr-2" />
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

      {/* Create Admin Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Admin</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="create_full_name">Full Name</Label>
              <Input
                id="create_full_name"
                placeholder="Enter full name"
                value={createFormData.full_name}
                onChange={(e) =>
                  setCreateFormData({ ...createFormData, full_name: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="create_email">Email</Label>
              <Input
                id="create_email"
                type="email"
                placeholder="Enter email address"
                value={createFormData.email}
                onChange={(e) =>
                  setCreateFormData({ ...createFormData, email: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="create_password">Password</Label>
              <Input
                id="create_password"
                type="password"
                placeholder="Enter password (min 8 characters)"
                value={createFormData.password}
                onChange={(e) =>
                  setCreateFormData({ ...createFormData, password: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="create_college">Allocate College</Label>
              <Select
                value={createFormData.college_id}
                onValueChange={(value) =>
                  setCreateFormData({ ...createFormData, college_id: value })
                }
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
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setCreateDialogOpen(false);
                  setCreateFormData({ full_name: "", email: "", password: "", college_id: "" });
                }}
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
