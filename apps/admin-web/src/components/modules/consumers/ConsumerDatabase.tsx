import { useState } from 'react';
import {
  Search,
  Filter,
  MoreHorizontal,
  Coins,
  History,
  Shield,
  Ban,
  MapPin,
  Calendar,
  Users,
  Download
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { ImageWithFallback } from '../../figma/ImageWithFallback';
import { toast } from 'sonner';

const users = [
  {
    id: 1,
    name: 'Rahul Sharma',
    phone: '+91 98765 43210',
    city: 'Hyderabad',
    ltv: 12500,
    lastOrder: '2 days ago',
    status: 'active',
    avatar: 'https://images.unsplash.com/photo-1638368349569-e49499196d9f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200'
  },
  {
    id: 2,
    name: 'Priya Patel',
    phone: '+91 98765 12345',
    city: 'Bangalore',
    ltv: 8900,
    lastOrder: '1 week ago',
    status: 'active',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80'
  },
  {
    id: 3,
    name: 'Amit Singh',
    phone: '+91 98765 67890',
    city: 'Hyderabad',
    ltv: 45000,
    lastOrder: 'Yesterday',
    status: 'active',
    avatar: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=200&q=80'
  },
  {
    id: 4,
    name: 'Sneha Gupta',
    phone: '+91 98765 11223',
    city: 'Mumbai',
    ltv: 1200,
    lastOrder: '1 month ago',
    status: 'blocked',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&q=80'
  },
  {
    id: 5,
    name: 'Vikram Malhotra',
    phone: '+91 98765 44556',
    city: 'Hyderabad',
    ltv: 2500,
    lastOrder: '3 days ago',
    status: 'active',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80'
  },
];

export function ConsumerDatabase() {
  const [searchTerm, setSearchTerm] = useState('');

  const handleGrantCredit = (user: typeof users[0]) => {
    toast.success(`Wallet Credit Granted`, {
      description: `₹50 has been added to ${user.name}'s wallet as a goodwill gesture.`
    });
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.phone.includes(searchTerm) ||
    user.city.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col bg-gray-50 px-6 pt-10 pb-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-600 flex items-center justify-center shadow-lg">
            <Users className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Consumer Base</h1>
            <p className="text-sm text-gray-500 font-medium">Manage customer accounts and support actions.</p>
          </div>
        </div>

        {/* Right Actions Toolbar */}
        <div className="flex items-center gap-0 bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm">
          <Button variant="ghost" size="sm" className="gap-2 text-gray-600 hover:text-fuchsia-600">
            <Filter className="w-4 h-4" />
            Filters
          </Button>
          <div className="w-px h-4 bg-gray-200 mx-1"></div>
          <Button variant="ghost" size="sm" className="gap-2 text-gray-600 hover:text-fuchsia-600">
            <Download className="w-4 h-4" />
            Export
          </Button>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search by Phone, Name, or User ID"
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="text-sm text-gray-500">
            {filteredUsers.length} Users Found
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="bg-gray-50 sticky top-0 z-10">
              <TableRow>
                <TableHead>User Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>LTV (₹)</TableHead>
                <TableHead>Last Order</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id} className="hover:bg-gray-50/50">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-200">
                        <ImageWithFallback
                          src={user.avatar}
                          alt={user.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{user.name}</p>
                        <p className="text-xs text-gray-500">ID: #{1000 + user.id}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm text-gray-700">{user.phone}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <MapPin className="w-3.5 h-3.5" />
                      {user.city}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-semibold text-gray-900">
                      ₹{user.ltv.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-gray-500">
                      <Calendar className="w-3.5 h-3.5" />
                      {user.lastOrder}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={user.status === 'active'
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-red-50 text-red-700 border-red-200'
                      }
                    >
                      {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700 h-8"
                        onClick={() => handleGrantCredit(user)}
                      >
                        <Coins className="w-4 h-4 mr-1.5" />
                        Credit
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>User Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => toast.info(`Viewing history for ${user.name}`)}>
                            <History className="w-4 h-4 mr-2" /> View Order History
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {user.status === 'active' ? (
                            <DropdownMenuItem className="text-red-600" onClick={() => toast.error(`Blocked ${user.name}`)}>
                              <Ban className="w-4 h-4 mr-2" /> Block User
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem className="text-green-600" onClick={() => toast.success(`Unblocked ${user.name}`)}>
                              <Shield className="w-4 h-4 mr-2" /> Unblock User
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
