import { useState, useEffect } from 'react';
import { Pencil, MapPin, Loader2 } from 'lucide-react';
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
import { Switch } from '../../ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../ui/select';
import { Separator } from '../../ui/separator';
import { useMerchants, Merchant } from '../../../hooks/useMerchants';

interface EditMerchantDialogProps {
    merchant: Merchant;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const CITIES = ['Hyderabad', 'Bangalore', 'Mumbai', 'Delhi', 'Chennai', 'Pune', 'Kolkata'];

export function EditMerchantDialog({ merchant, open, onOpenChange }: EditMerchantDialogProps) {
    const { updateMerchant, loading } = useMerchants();

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
        status: 'active' as 'active' | 'inactive' | 'blacklisted',
        kyc_status: 'pending' as 'pending' | 'approved' | 'rejected',
    });

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
                status: merchant.status || 'active',
                kyc_status: merchant.kyc_status || 'pending',
            });
        }
    }, [merchant]);

    const handleSave = async () => {
        try {
            await updateMerchant(merchant.id, formData);
            onOpenChange(false);
        } catch (error) {
            console.error('Failed to update merchant:', error);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Pencil className="w-5 h-5" />
                        Edit Merchant Details
                    </DialogTitle>
                    <DialogDescription>
                        Update {merchant?.store_name}'s information
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-4">
                    {/* Store Info */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-gray-900">Store Information</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="store_name" className="text-xs">Store Name</Label>
                                <Input
                                    id="store_name"
                                    value={formData.store_name}
                                    onChange={(e) => setFormData({ ...formData, store_name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="branch_name" className="text-xs">Branch Name</Label>
                                <Input
                                    id="branch_name"
                                    value={formData.branch_name}
                                    onChange={(e) => setFormData({ ...formData, branch_name: e.target.value })}
                                    placeholder="Main / Outlet 2"
                                />
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Contact Info */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-gray-900">Contact Details</h4>
                        <div className="space-y-1.5">
                            <Label htmlFor="owner_name" className="text-xs">Owner Name</Label>
                            <Input
                                id="owner_name"
                                value={formData.owner_name}
                                onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="phone" className="text-xs">Phone</Label>
                                <Input
                                    id="phone"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="email" className="text-xs">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Location */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                            <MapPin className="w-4 h-4" /> Location
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="city" className="text-xs">City</Label>
                                <Select value={formData.city} onValueChange={(v) => setFormData({ ...formData, city: v })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select city" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CITIES.map(city => (
                                            <SelectItem key={city} value={city}>{city}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="operating_hours" className="text-xs">Operating Hours</Label>
                                <Input
                                    id="operating_hours"
                                    value={formData.operating_hours}
                                    onChange={(e) => setFormData({ ...formData, operating_hours: e.target.value })}
                                    placeholder="9 AM - 10 PM"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="address" className="text-xs">Full Address</Label>
                            <Textarea
                                id="address"
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                placeholder="Shop No, Street, Landmark..."
                                className="resize-none h-16"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="latitude" className="text-xs">Latitude</Label>
                                <Input
                                    id="latitude"
                                    type="number"
                                    step="any"
                                    value={formData.latitude}
                                    onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="longitude" className="text-xs">Longitude</Label>
                                <Input
                                    id="longitude"
                                    type="number"
                                    step="any"
                                    value={formData.longitude}
                                    onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Operations */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-gray-900">Operations</h4>
                        <div className="space-y-1.5">
                            <Label htmlFor="commission_rate" className="text-xs">Commission Rate (%)</Label>
                            <Input
                                id="commission_rate"
                                type="number"
                                min={0}
                                max={100}
                                value={formData.commission_rate}
                                onChange={(e) => setFormData({ ...formData, commission_rate: parseFloat(e.target.value) || 0 })}
                            />
                        </div>
                    </div>

                    <Separator />

                    {/* Status */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-gray-900">Status & KYC</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Store Status</Label>
                                <Select value={formData.status} onValueChange={(v: any) => setFormData({ ...formData, status: v })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="inactive">Inactive</SelectItem>
                                        <SelectItem value="blacklisted">Blacklisted</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">KYC Status</Label>
                                <Select value={formData.kyc_status} onValueChange={(v: any) => setFormData({ ...formData, kyc_status: v })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pending">Pending</SelectItem>
                                        <SelectItem value="approved">Approved</SelectItem>
                                        <SelectItem value="rejected">Rejected</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={loading} className="gap-2">
                        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
