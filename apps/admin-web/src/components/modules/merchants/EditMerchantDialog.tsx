import { useState, useEffect } from 'react';
import { Loader2, Plus, Trash2, Store, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../ui/select';
import { Separator } from '../../ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '../../ui/toggle-group';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '../../ui/table';
import { useMerchants, Merchant } from '../../../hooks/useMerchants';
import { toast } from 'sonner';

interface EditMerchantDialogProps {
    merchant: Merchant;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onRefresh: () => void;
}

const CITIES = ['Hyderabad', 'Bangalore', 'Mumbai', 'Delhi', 'Chennai', 'Pune', 'Kolkata'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function EditMerchantDialog({ merchant, open, onOpenChange, onRefresh }: EditMerchantDialogProps) {
    const navigate = useNavigate();
    const { updateMerchant, addMerchantBranch, deleteMerchantBranch, loading } = useMerchants();
    const [activeTab, setActiveTab] = useState('details');

    // Merchant Data Form
    const [formData, setFormData] = useState({
        store_name: '',
        branch_name: '',
        owner_name: '',
        phone: '',
        email: '',
        city: '',
        address: '',
        latitude: 0,
        longitude: 0,
        commission_rate: 10,
        operating_hours: '',
        operating_days: [] as string[],
        status: 'active' as 'active' | 'inactive' | 'blacklisted',
        kyc_status: 'pending' as 'pending' | 'approved' | 'rejected',
        pan_number: '',
        aadhar_number: '',
        bank_account_number: '',
        ifsc_code: '',
    });

    // New Branch Form
    const [newBranch, setNewBranch] = useState({
        branch_name: '',
        manager_name: '',
        phone: '',
        city: '',
        address: ''
    });
    const [isAddingBranch, setIsAddingBranch] = useState(false);

    useEffect(() => {
        if (merchant) {
            setFormData({
                store_name: merchant.store_name || '',
                branch_name: merchant.branch_name || '',
                owner_name: merchant.owner_name || '',
                phone: merchant.phone || '',
                email: merchant.email || '',
                city: merchant.city || '',
                address: merchant.address || '',
                latitude: merchant.latitude || 0,
                longitude: merchant.longitude || 0,
                commission_rate: merchant.commission_rate || 10,
                operating_hours: merchant.operating_hours || '',
                operating_days: merchant.operating_days || [],
                status: merchant.status || 'active',
                kyc_status: merchant.kyc_status || 'pending',
                pan_number: merchant.pan_number || '',
                aadhar_number: merchant.aadhar_number || '',
                bank_account_number: merchant.bank_account_number || '',
                ifsc_code: merchant.ifsc_code || '',
            });
        }
    }, [merchant]);

    const handleSave = async () => {
        try {
            await updateMerchant(merchant.id, formData);
            onRefresh();
            onOpenChange(false);
        } catch (error) {
            console.error('Failed to update merchant:', error);
        }
    };

    const handleAddBranch = async () => {
        if (!newBranch.branch_name || !newBranch.city) {
            toast.error("Branch Name and City are required");
            return;
        }
        setIsAddingBranch(true);
        try {
            await addMerchantBranch({
                merchant_id: merchant.id,
                ...newBranch,
                is_active: true
            });
            setNewBranch({ branch_name: '', manager_name: '', phone: '', city: '', address: '' });
            onRefresh();
        } catch (error) {
            // Error handled in hook
        } finally {
            setIsAddingBranch(false);
        }
    };

    const handleDeleteBranch = async (id: string) => {
        if (confirm('Are you sure you want to delete this branch?')) {
            await deleteMerchantBranch(id);
            onRefresh();
        }
    };

    const goToCatalog = () => {
        // Navigate to catalog with merchant filter? 
        // Currently standard catalog page. We can pass a query param if supported, or just go there.
        navigate('/catalog');
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
                <DialogHeader className="px-6 py-4 border-b">
                    <div className="flex items-center justify-between">
                        <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
                            <Store className="w-5 h-5 text-primary" />
                            Edit: {merchant?.store_name}
                        </DialogTitle>
                        <Button variant="outline" size="sm" className="gap-2 text-primary hover:text-primary/90" onClick={goToCatalog}>
                            <ExternalLink className="w-4 h-4" />
                            Catalog
                        </Button>
                    </div>
                    <DialogDescription className="sr-only">
                        Edit details for {merchant?.store_name}
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                    <div className="px-6 border-b bg-background">
                        <TabsList className="flex w-full justify-start rounded-none p-0 bg-transparent h-auto gap-2">
                            <TabsTrigger
                                value="details"
                                className="rounded-md border border-transparent px-4 py-2 text-sm font-medium text-gray-500 data-[state=active]:bg-black data-[state=active]:text-white data-[state=active]:shadow-sm hover:text-gray-900 transition-colors"
                            >
                                Details
                            </TabsTrigger>
                            <TabsTrigger
                                value="branches"
                                className="rounded-md border border-transparent px-4 py-2 text-sm font-medium text-gray-500 data-[state=active]:bg-black data-[state=active]:text-white data-[state=active]:shadow-sm hover:text-gray-900 transition-colors"
                            >
                                Branches
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="flex-1 overflow-y-auto px-6 py-4">
                        <TabsContent value="details" className="space-y-6 mt-0">
                            {/* Store Info */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Store Info</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium">Store Name</Label>
                                        <Input
                                            value={formData.store_name}
                                            onChange={(e) => setFormData({ ...formData, store_name: e.target.value })}
                                            className="h-9"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium">Main Branch Name</Label>
                                        <Input
                                            value={formData.branch_name}
                                            onChange={(e) => setFormData({ ...formData, branch_name: e.target.value })}
                                            placeholder="Main / Head Office"
                                            className="h-9"
                                        />
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            {/* Contact & Location */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Contact & Location</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium">Owner Name</Label>
                                        <Input
                                            value={formData.owner_name}
                                            onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                                            className="h-9"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium">Phone</Label>
                                        <Input
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                            className="h-9"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium">Email</Label>
                                        <Input
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            className="h-9"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium">City</Label>
                                        <Select value={formData.city} onValueChange={(v) => setFormData({ ...formData, city: v })}>
                                            <SelectTrigger className="h-9">
                                                <SelectValue placeholder="Select city" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {CITIES.map(city => (
                                                    <SelectItem key={city} value={city}>{city}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium">Full Address</Label>
                                    <Textarea
                                        value={formData.address}
                                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                        className="h-16 resize-none"
                                    />
                                </div>
                            </div>

                            <Separator />

                            {/* Operations */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Operations</h4>
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-medium">Operating Hours</Label>
                                            <Input
                                                value={formData.operating_hours}
                                                onChange={(e) => setFormData({ ...formData, operating_hours: e.target.value })}
                                                placeholder="9:00 AM - 10:00 PM"
                                                className="h-9"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-medium">Commission Rate (%)</Label>
                                            <Input
                                                type="number"
                                                value={formData.commission_rate}
                                                onChange={(e) => setFormData({ ...formData, commission_rate: parseFloat(e.target.value) || 0 })}
                                                className="h-9"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-medium">Operating Days</Label>
                                        <ToggleGroup
                                            type="multiple"
                                            variant="outline"
                                            value={formData.operating_days}
                                            onValueChange={(val) => setFormData({ ...formData, operating_days: val })}
                                            className="justify-start gap-2"
                                        >
                                            {DAYS.map(day => (
                                                <ToggleGroupItem
                                                    key={day}
                                                    value={day}
                                                    aria-label={day}
                                                    className="h-8 w-10 text-xs data-[state=on]:bg-blue-600 data-[state=on]:text-white data-[state=on]:border-blue-600 hover:bg-gray-100 transition-colors"
                                                >
                                                    {day}
                                                </ToggleGroupItem>
                                            ))}
                                        </ToggleGroup>
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            {/* Bank & KYC */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Bank & KYC</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium">PAN Number</Label>
                                        <Input
                                            value={formData.pan_number}
                                            onChange={(e) => setFormData({ ...formData, pan_number: e.target.value })}
                                            className="h-9"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium">Aadhar Number</Label>
                                        <Input
                                            value={formData.aadhar_number}
                                            onChange={(e) => setFormData({ ...formData, aadhar_number: e.target.value })}
                                            className="h-9"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium">Bank Account</Label>
                                        <Input
                                            value={formData.bank_account_number}
                                            onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value })}
                                            className="h-9"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium">IFSC Code</Label>
                                        <Input
                                            value={formData.ifsc_code}
                                            onChange={(e) => setFormData({ ...formData, ifsc_code: e.target.value })}
                                            className="h-9"
                                        />
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="branches" className="space-y-6 mt-0">
                            {/* Branch List */}
                            <div className="border rounded-md overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-gray-50">
                                        <TableRow>
                                            <TableHead>Branch Name</TableHead>
                                            <TableHead>City</TableHead>
                                            <TableHead>Manager</TableHead>
                                            <TableHead className="w-[80px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {merchant.merchant_branches && merchant.merchant_branches.length > 0 ? (
                                            merchant.merchant_branches.map((branch) => (
                                                <TableRow key={branch.id}>
                                                    <TableCell className="font-medium">{branch.branch_name}</TableCell>
                                                    <TableCell>{branch.city}</TableCell>
                                                    <TableCell>{branch.manager_name || '-'}</TableCell>
                                                    <TableCell>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                            onClick={() => handleDeleteBranch(branch.id)}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                                                    No additional branches found.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Add Branch Form */}
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-4">
                                <h4 className="text-sm font-semibold flex items-center gap-2 text-gray-900">
                                    <Plus className="w-4 h-4" /> Add New Branch
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <Input
                                        placeholder="Branch Name *"
                                        value={newBranch.branch_name}
                                        onChange={(e) => setNewBranch({ ...newBranch, branch_name: e.target.value })}
                                        className="h-9 bg-white"
                                    />
                                    <Select
                                        value={newBranch.city}
                                        onValueChange={(v) => setNewBranch({ ...newBranch, city: v })}
                                    >
                                        <SelectTrigger className="h-9 bg-white">
                                            <SelectValue placeholder="Select City *" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {CITIES.map(city => (
                                                <SelectItem key={city} value={city}>{city}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Input
                                        placeholder="Manager Name"
                                        value={newBranch.manager_name}
                                        onChange={(e) => setNewBranch({ ...newBranch, manager_name: e.target.value })}
                                        className="h-9 bg-white"
                                    />
                                    <Input
                                        placeholder="Phone"
                                        value={newBranch.phone}
                                        onChange={(e) => setNewBranch({ ...newBranch, phone: e.target.value })}
                                        className="h-9 bg-white"
                                    />
                                    <Input
                                        placeholder="Address"
                                        value={newBranch.address}
                                        onChange={(e) => setNewBranch({ ...newBranch, address: e.target.value })}
                                        className="h-9 bg-white col-span-2"
                                    />
                                </div>
                                <div className="flex justify-end">
                                    <Button
                                        size="sm"
                                        onClick={handleAddBranch}
                                        disabled={isAddingBranch}
                                        className="bg-gray-900 text-white shadow-sm"
                                    >
                                        {isAddingBranch && <Loader2 className="w-3 h-3 animate-spin mr-2" />}
                                        Add Branch
                                    </Button>
                                </div>
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>

                <DialogFooter className="px-6 py-4 border-t bg-gray-50">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={loading} className="gap-2 bg-black text-white hover:bg-gray-800 shadow-sm">
                        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
