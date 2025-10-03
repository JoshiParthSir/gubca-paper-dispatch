import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { z } from 'zod';

const collegeSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  code: z.string().trim().min(2, 'Code must be at least 2 characters'),
  address: z.string().trim().optional(),
  contact_email: z.string().trim().email('Invalid email').optional().or(z.literal('')),
  contact_phone: z.string().trim().optional(),
  admin_full_name: z.string().trim().min(2, 'Admin name must be at least 2 characters'),
  admin_email: z.string().trim().email('Invalid admin email'),
  admin_password: z.string().min(6, 'Password must be at least 6 characters'),
});

interface College {
  id: string;
  name: string;
  code: string;
  address: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  created_at: string;
}

export default function Colleges() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [colleges, setColleges] = useState<College[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCollege, setEditingCollege] = useState<College | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    address: '',
    contact_email: '',
    contact_phone: '',
    admin_full_name: '',
    admin_email: '',
    admin_password: '',
  });

  useEffect(() => {
    fetchColleges();
  }, []);

  const fetchColleges = async () => {
    try {
      const { data, error } = await supabase
        .from('colleges')
        .select('*')
        .order('name');

      if (error) throw error;
      setColleges(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingCollege) {
        // When editing, only update college details (not admin)
        const { error } = await supabase
          .from('colleges')
          .update({
            name: formData.name,
            code: formData.code,
            address: formData.address,
            contact_email: formData.contact_email,
            contact_phone: formData.contact_phone,
          })
          .eq('id', editingCollege.id);

        if (error) throw error;
        toast({ title: 'College updated successfully' });
      } else {
        // Validate form data
        const validatedData = collegeSchema.parse(formData);

        // First create the college
        const { data: collegeData, error: collegeError } = await supabase
          .from('colleges')
          .insert([{
            name: validatedData.name,
            code: validatedData.code,
            address: validatedData.address || null,
            contact_email: validatedData.contact_email || null,
            contact_phone: validatedData.contact_phone || null,
            created_by: user!.id
          }])
          .select()
          .single();

        if (collegeError) throw collegeError;

        // Then create the college admin
        const { data: functionData, error: functionError } = await supabase.functions.invoke(
          'create-college-admin',
          {
            body: {
              email: validatedData.admin_email,
              password: validatedData.admin_password,
              full_name: validatedData.admin_full_name,
              college_id: collegeData.id,
            },
          }
        );

        if (functionError) throw functionError;
        if (functionData?.error) throw new Error(functionData.error);

        toast({ 
          title: 'Success',
          description: 'College and admin account created successfully'
        });
      }

      setDialogOpen(false);
      resetForm();
      fetchColleges();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast({
          title: 'Validation Error',
          description: error.errors[0].message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        });
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this college?')) return;

    try {
      const { error } = await supabase
        .from('colleges')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'College deleted successfully' });
      fetchColleges();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      address: '',
      contact_email: '',
      contact_phone: '',
      admin_full_name: '',
      admin_email: '',
      admin_password: '',
    });
    setEditingCollege(null);
  };

  const openEditDialog = (college: College) => {
    setEditingCollege(college);
    setFormData({
      name: college.name,
      code: college.code,
      address: college.address || '',
      contact_email: college.contact_email || '',
      contact_phone: college.contact_phone || '',
      admin_full_name: '',
      admin_email: '',
      admin_password: '',
    });
    setDialogOpen(true);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Colleges</h1>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add College
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCollege ? 'Edit College' : 'Add New College'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">College Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="code">College Code</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="email">Contact Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="phone">Contact Phone</Label>
                <Input
                  id="phone"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                />
              </div>

              {!editingCollege && (
                <>
                  <div className="pt-4 border-t">
                    <h3 className="text-sm font-semibold mb-3">College Admin Details</h3>
                  </div>
                  <div>
                    <Label htmlFor="admin_full_name">Admin Full Name</Label>
                    <Input
                      id="admin_full_name"
                      value={formData.admin_full_name}
                      onChange={(e) => setFormData({ ...formData, admin_full_name: e.target.value })}
                      required={!editingCollege}
                    />
                  </div>
                  <div>
                    <Label htmlFor="admin_email">Admin Email</Label>
                    <Input
                      id="admin_email"
                      type="email"
                      value={formData.admin_email}
                      onChange={(e) => setFormData({ ...formData, admin_email: e.target.value })}
                      required={!editingCollege}
                    />
                  </div>
                  <div>
                    <Label htmlFor="admin_password">Admin Password</Label>
                    <Input
                      id="admin_password"
                      type="password"
                      value={formData.admin_password}
                      onChange={(e) => setFormData({ ...formData, admin_password: e.target.value })}
                      required={!editingCollege}
                      minLength={6}
                    />
                  </div>
                </>
              )}

              <Button type="submit" className="w-full">
                {editingCollege ? 'Update' : 'Create'} College
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {colleges.map((college) => (
          <Card key={college.id}>
            <CardHeader>
              <CardTitle className="flex justify-between items-start">
                <span>{college.name}</span>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditDialog(college)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(college.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <p><strong>Code:</strong> {college.code}</p>
                {college.address && <p><strong>Address:</strong> {college.address}</p>}
                {college.contact_email && <p><strong>Email:</strong> {college.contact_email}</p>}
                {college.contact_phone && <p><strong>Phone:</strong> {college.contact_phone}</p>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
