import { useEffect, useState } from 'react';
import { hasCached, useCachedState } from '@/lib/page-cache';
import { PageSkeleton } from '@/components/PageFallback';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Upload } from 'lucide-react';
import { BulkImportDialog } from '@/components/BulkImportDialog';
import { parseBool } from '@/lib/csv';
import { Badge } from '@/components/ui/badge';

interface Batch {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export default function Batches() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [batches, setBatches] = useCachedState<Batch[]>('batches:batches', []);
  // Only the first visit shows a skeleton; later visits render cached data instantly
  const [loading, setLoading] = useState(!hasCached('batches:batches'));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_active: true,
  });

  useEffect(() => {
    fetchBatches();
  }, []);

  const fetchBatches = async () => {
    try {
      const { data, error } = await supabase
        .from('batches')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setBatches(data || []);
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
      if (editingBatch) {
        const { error } = await supabase
          .from('batches')
          .update(formData)
          .eq('id', editingBatch.id);

        if (error) throw error;
        toast({ title: 'Batch updated successfully' });
      } else {
        const { error } = await supabase
          .from('batches')
          .insert([{ ...formData, created_by: user!.id }]);

        if (error) throw error;
        toast({ title: 'Batch created successfully' });
      }

      setDialogOpen(false);
      resetForm();
      fetchBatches();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this batch?')) return;

    try {
      const { error } = await supabase
        .from('batches')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Batch deleted successfully' });
      fetchBatches();
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
      description: '',
      is_active: true,
    });
    setEditingBatch(null);
  };

  const openEditDialog = (batch: Batch) => {
    setEditingBatch(batch);
    setFormData({
      name: batch.name,
      description: batch.description || '',
      is_active: batch.is_active,
    });
    setDialogOpen(true);
  };

  const importBatch = async (row: Record<string, string>) => {
    const values = {
      name: row.name.trim().substring(0, 200),
      description: row.description?.trim() || null,
      is_active: parseBool(row.is_active, true),
    };
    const existing = batches.find((b) => b.name.trim().toLowerCase() === values.name.toLowerCase());
    if (existing) {
      const { error } = await supabase.from('batches').update(values).eq('id', existing.id);
      if (error) throw error;
      return 'Updated existing batch';
    }
    const { error } = await supabase.from('batches').insert({ ...values, created_by: user!.id });
    if (error) throw error;
    return 'Created';
  };

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h1>Batches</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setBulkOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Bulk Import
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Batch
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingBatch ? 'Edit Batch' : 'Add New Batch'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Batch Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label htmlFor="is_active">Active</Label>
                </div>
                <Button type="submit" className="w-full">
                  {editingBatch ? 'Update' : 'Create'} Batch
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <BulkImportDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        title="Bulk Import Batches"
        description="Rows whose name matches an existing batch update that batch; other rows create new batches."
        templateFileName="batches-template.csv"
        columns={[
          { key: 'name', required: true },
          { key: 'description' },
          { key: 'is_active', hint: 'yes / no (default yes)' },
        ]}
        sampleRows={[['BCA Sem 1 - 2026', 'First semester regular exams', 'yes']]}
        validateRow={(row, i, all) => {
          const name = row.name.trim().toLowerCase();
          if (all.findIndex((r) => r.name?.trim().toLowerCase() === name) !== i) return 'Duplicate name in file';
          return null;
        }}
        processRow={importBatch}
        onComplete={fetchBatches}
      />

      <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {batches.map((batch) => (
          <Card key={batch.id}>
            <CardHeader>
              <CardTitle className="flex justify-between items-start">
                <span>{batch.name}</span>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditDialog(batch)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(batch.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {batch.description && <p className="text-sm text-muted-foreground">{batch.description}</p>}
                <Badge variant={batch.is_active ? 'default' : 'secondary'}>
                  {batch.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
