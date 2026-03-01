import { useState, useEffect } from 'react';
import {
  Shield,
  Trash2,
  Edit2,
  Plus,
  Loader2
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Card } from '../../ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';
import { AddAdminDialog } from './AddAdminDialog';
import { EditAdminDialog } from './EditAdminDialog';
import { DeleteAdminDialog } from './DeleteAdminDialog';
import { supabase } from '../../../lib/supabaseClient';

interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string;
}

export function TeamManagement() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editAdmin, setEditAdmin] = useState<AdminUser | null>(null);
  const [deleteAdmin, setDeleteAdmin] = useState<AdminUser | null>(null);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch admins from database
  const fetchAdmins = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('User')
      .select('id, name, email, role, createdAt')
      .eq('role', 'SUPER_ADMIN')
      .order('createdAt', { ascending: false });

    if (error) {
      console.error('Error fetching admins:', error);
    } else {
      setAdmins(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleAddClose = () => {
    setIsAddDialogOpen(false);
    fetchAdmins();
  };

  const handleEditClose = () => {
    setEditAdmin(null);
    fetchAdmins();
  };

  const handleDeleteClose = () => {
    setDeleteAdmin(null);
    fetchAdmins();
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Super Admin Management</h2>
          <p className="text-sm text-gray-500">Manage admin accounts and access.</p>
        </div>
        <Button
          className="bg-[#121212] hover:bg-[#2d2d2d] gap-2"
          onClick={() => setIsAddDialogOpen(true)}
        >
          <Plus className="w-4 h-4" /> Add Admin
        </Button>
      </div>

      <AddAdminDialog isOpen={isAddDialogOpen} onClose={handleAddClose} />
      <EditAdminDialog isOpen={!!editAdmin} onClose={handleEditClose} admin={editAdmin} />
      <DeleteAdminDialog isOpen={!!deleteAdmin} onClose={handleDeleteClose} admin={deleteAdmin} />

      <Card className="border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : admins.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Shield className="w-12 h-12 mb-4 text-gray-300" />
            <p className="font-medium">No admins found</p>
            <p className="text-sm">Create your first admin account to get started.</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead>User Details</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins.map((admin) => (
                <TableRow key={admin.id} className="hover:bg-gray-50/50">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#B52725] to-[#FFCC05] flex items-center justify-center text-white font-semibold">
                        {(admin.name || admin.email).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{admin.name || 'Unnamed'}</p>
                        <p className="text-xs text-gray-500">{admin.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">
                      Super Admin
                    </Badge>
                  </TableCell>
                  <TableCell className="text-gray-600 text-sm">
                    {new Date(admin.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-500 hover:text-[#B52725]"
                        onClick={() => setEditAdmin(admin)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => setDeleteAdmin(admin)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
