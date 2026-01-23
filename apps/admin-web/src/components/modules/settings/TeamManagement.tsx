import { useState } from 'react';
import { 
  Shield, 
  Trash2, 
  Edit2, 
  Plus, 
  MoreHorizontal,
  Lock,
  Mail,
  Check,
  X
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import { Checkbox } from '../../ui/checkbox';
import { Card } from '../../ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { Label } from '../../ui/label';
import { toast } from 'sonner';

const teamMembers = [
  { id: 1, name: 'Aditya Rao', email: 'aditya@pickatstore.com', role: 'Super Admin', lastLogin: 'Just now', color: 'gold' },
  { id: 2, name: 'Sneha Reddy', email: 'sneha@pickatstore.com', role: 'Support Agent', lastLogin: '2 hours ago', color: 'gray' },
  { id: 3, name: 'Karthik M', email: 'karthik@pickatstore.com', role: 'Finance Lead', lastLogin: 'Yesterday', color: 'blue' },
];

const modules = ['Finance', 'Orders', 'Users', 'Inventory', 'Marketing'];
const permissions = ['Read', 'Write', 'Delete'];

export function TeamManagement() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', role: '' });

  const handleSave = () => {
    toast.success('User Invitation Sent', {
      description: `${newUser.name} has been invited as ${newUser.role}`
    });
    setIsModalOpen(false);
    setNewUser({ name: '', email: '', role: '' });
  };

  const getRoleBadgeColor = (color: string) => {
    switch (color) {
      case 'gold': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'gray': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'blue': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Internal Team Management</h2>
          <p className="text-sm text-gray-500">Manage admin access and RBAC policies.</p>
        </div>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 gap-2">
              <Plus className="w-4 h-4" /> Add Admin User
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Add New Team Member</DialogTitle>
              <DialogDescription>
                Send an invitation and configure access permissions.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input 
                    placeholder="e.g. John Doe" 
                    value={newUser.name}
                    onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <Input 
                    placeholder="john@pickatstore.com" 
                    value={newUser.email}
                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Role Template</Label>
                <Select 
                  value={newUser.role} 
                  onValueChange={(val) => setNewUser({...newUser, role: val})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Super Admin">Super Admin (Full Access)</SelectItem>
                    <SelectItem value="Support Agent">Support Agent (Limited)</SelectItem>
                    <SelectItem value="Finance Lead">Finance Lead</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Permission Matrix */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 font-medium text-sm text-gray-700 flex items-center gap-2">
                  <Shield className="w-4 h-4" /> Permission Matrix
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="h-8">
                      <TableHead className="h-8 py-2">Module</TableHead>
                      <TableHead className="h-8 py-2 text-center w-[80px]">Read</TableHead>
                      <TableHead className="h-8 py-2 text-center w-[80px]">Write</TableHead>
                      <TableHead className="h-8 py-2 text-center w-[80px]">Delete</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modules.slice(0, 3).map((mod) => (
                      <TableRow key={mod} className="h-10">
                        <TableCell className="py-2 font-medium">{mod}</TableCell>
                        <TableCell className="py-2 text-center">
                          <Checkbox defaultChecked />
                        </TableCell>
                        <TableCell className="py-2 text-center">
                          <Checkbox defaultChecked={newUser.role === 'Super Admin'} />
                        </TableCell>
                        <TableCell className="py-2 text-center">
                          <Checkbox defaultChecked={newUser.role === 'Super Admin'} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="bg-yellow-50 p-2 text-xs text-yellow-800 text-center border-t border-yellow-100">
                  Detailed permissions are applied based on the selected Role Template.
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">Send Invitation</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-gray-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead>User Details</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teamMembers.map((member) => (
              <TableRow key={member.id} className="hover:bg-gray-50/50">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-semibold border border-gray-200">
                      {member.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{member.name}</p>
                      <p className="text-xs text-gray-500">{member.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={getRoleBadgeColor(member.color)}>
                    {member.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-gray-600 text-sm">
                  {member.lastLogin}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-blue-600">
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-red-600 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
