import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Pencil, KeyRound, Loader2, User, Mail, Building2 } from "lucide-react";

interface College {
  id: string;
  name: string;
  code: string;
}

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [college, setCollege] = useState<College | null>(null);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({ full_name: "" });
  const [passwordData, setPasswordData] = useState({ 
    currentPassword: "", 
    newPassword: "", 
    confirmPassword: "" 
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (profile) {
      fetchCollegeInfo();
      setEditFormData({ full_name: profile.full_name || "" });
    }
  }, [profile]);

  const fetchCollegeInfo = async () => {
    if (!profile?.college_id) {
      setLoading(false);
      return;
    }

    try {
      const { data: collegeData, error } = await supabase
        .from("colleges")
        .select("id, name, code")
        .eq("id", profile.college_id)
        .single();

      if (error) throw error;
      setCollege(collegeData);
    } catch (error: any) {
      console.error("Error fetching college info:", error);
      toast({
        title: "Error",
        description: "Failed to load college information",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!user || !profile) return;

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

      // Update profile in the database
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: editFormData.full_name.trim() })
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Profile updated successfully",
      });

      setEditDialogOpen(false);
      // Refresh the profile data
      await refreshProfile();
    } catch (error: any) {
      console.error("Update profile error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!user) return;

    try {
      setSubmitting(true);

      // Validate passwords
      if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
        toast({
          title: "Error",
          description: "All password fields are required",
          variant: "destructive",
        });
        return;
      }

      if (passwordData.newPassword !== passwordData.confirmPassword) {
        toast({
          title: "Error",
          description: "New passwords do not match",
          variant: "destructive",
        });
        return;
      }

      if (passwordData.newPassword.length < 8) {
        toast({
          title: "Error",
          description: "New password must be at least 8 characters",
          variant: "destructive",
        });
        return;
      }

      // First verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile?.email || "",
        password: passwordData.currentPassword,
      });

      if (signInError) {
        toast({
          title: "Error",
          description: "Current password is incorrect",
          variant: "destructive",
        });
        return;
      }

      // Update password
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Password updated successfully",
      });

      setPasswordDialogOpen(false);
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (error: any) {
      console.error("Password change error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update password",
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
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Profile Settings</h1>
        <p className="text-muted-foreground">Manage your account information and security settings</p>
      </div>

      <div className="grid gap-6">
        {/* Profile Information Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile Information
            </CardTitle>
            <CardDescription>
              Your personal information and account details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Full Name</Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 p-3 bg-muted rounded-md">
                    {profile?.full_name || "Not set"}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditDialogOpen(true)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Email Address</Label>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 p-3 bg-muted rounded-md text-muted-foreground">
                    {profile?.email || "Not set"}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed. Contact administrator if needed.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Role</Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 p-3 bg-muted rounded-md capitalize">
                    {profile?.role?.replace('_', ' ') || "Not set"}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Assigned College</Label>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 p-3 bg-muted rounded-md">
                    {college ? `${college.name} (${college.code})` : "Not assigned"}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  College assignment is managed by the chairperson.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security Settings Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Security Settings
            </CardTitle>
            <CardDescription>
              Manage your password and account security
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h3 className="font-medium">Password</h3>
                  <p className="text-sm text-muted-foreground">
                    Last updated: {new Date().toLocaleDateString()}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setPasswordDialogOpen(true)}
                >
                  <KeyRound className="h-4 w-4 mr-2" />
                  Change Password
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Profile Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Profile Information</DialogTitle>
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
                placeholder="Enter your full name"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button onClick={handleUpdateProfile} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Update Profile
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="current_password">Current Password</Label>
              <Input
                id="current_password"
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, currentPassword: e.target.value })
                }
                placeholder="Enter your current password"
              />
            </div>
            <div>
              <Label htmlFor="new_password">New Password</Label>
              <Input
                id="new_password"
                type="password"
                value={passwordData.newPassword}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, newPassword: e.target.value })
                }
                placeholder="Enter new password (min 8 characters)"
              />
            </div>
            <div>
              <Label htmlFor="confirm_password">Confirm New Password</Label>
              <Input
                id="confirm_password"
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                }
                placeholder="Confirm your new password"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setPasswordDialogOpen(false);
                  setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
                }}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button onClick={handlePasswordChange} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Change Password
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
