import { useState, useEffect } from 'react';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
    SheetFooter
} from "../../ui/sheet";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { toast } from 'sonner';
import { useMerchants } from '../../../hooks/useMerchants';
import { Loader2, Plus, ChevronRight, ChevronLeft, ShieldCheck, Trash2, Store, GitBranch, MapPin } from 'lucide-react';
import { LocationPicker } from '../../ui/location-picker';
import { KYCForm, KYCData } from './onboarding/KYCForm';
import { OnboardingStepper } from './onboarding/OnboardingStepper';
import { Checkbox } from '../../ui/checkbox';

interface AddMerchantSheetProps {
    trigger?: React.ReactNode;
    onSuccess?: () => void;
}

const STEPS = [
    { label: 'Store Info' },
    { label: 'Branches' },
    { label: 'KYC & Docs' }
];

export function AddMerchantSheet({ trigger, onSuccess }: AddMerchantSheetProps) {
    const { createMerchant } = useMerchants();
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingLocation, setIsLoadingLocation] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        ownerName: '',
        city: 'Hyderabad',
        address: '',
        latitude: 17.3850,
        longitude: 78.4867,
        hasBranches: false
    });

    const [branches, setBranches] = useState<{ name: string, location: string }[]>([]);

    const [kycData, setKycData] = useState<KYCData>({
        panNumber: '',
        aadharNumber: '',
        bankAccount: '',
        ifsc: '',
        turnoverRange: '<20L'
    });

    // Auto-request location when sheet opens
    useEffect(() => {
        if (open && navigator.geolocation) {
            setIsLoadingLocation(true);
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    setFormData(prev => ({
                        ...prev,
                        latitude,
                        longitude
                    }));
                    setIsLoadingLocation(false);
                    toast.success('Location detected!', {
                        description: 'Map centered on your current location.'
                    });
                },
                (error) => {
                    setIsLoadingLocation(false);
                    if (error.code === error.PERMISSION_DENIED) {
                        toast.info('Location access', {
                            description: 'Click the crosshair on the map to use your location.'
                        });
                    }
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
            );
        }
    }, [open]);

    const handleNext = () => setStep(p => p + 1);
    const handleBack = () => setStep(p => p - 1);

    const handleSubmit = async () => {
        try {
            setIsSubmitting(true);

            // Map form fields to database schema
            const payload = {
                store_name: formData.name,
                owner_name: formData.ownerName,
                email: formData.email,
                phone: formData.phone,
                city: formData.city,
                address: formData.address,
                latitude: formData.latitude,
                longitude: formData.longitude,
                has_branches: formData.hasBranches,
                // Map KYC fields
                pan_number: kycData.panNumber,
                aadhar_number: kycData.aadharNumber,
                bank_account_number: kycData.bankAccount,
                ifsc_code: kycData.ifsc,
                turnover_range: kycData.turnoverRange
            };

            console.log("Submitting Payload to Supabase:", payload);

            await createMerchant(payload, {
                pan: kycData.panDocument,
                aadharFront: kycData.aadharFront,
                aadharBack: kycData.aadharBack
            });

            toast.success(`Merchant "${formData.name}" onboarded successfully!`);

            // Call onSuccess callback to refresh the parent's merchant list
            if (onSuccess) {
                onSuccess();
            }

            setOpen(false);
            setStep(1);
            // Reset form
            setFormData({
                name: '',
                email: '',
                phone: '',
                ownerName: '',
                city: 'Hyderabad',
                address: '',
                latitude: 17.3850,
                longitude: 78.4867,
                hasBranches: false
            });
            setBranches([]);
            setKycData({
                panNumber: '',
                aadharNumber: '',
                bankAccount: '',
                ifsc: '',
                turnoverRange: '<20L'
            });
        } catch (error: any) {
            console.error(error);
            toast.error("Failed to onboard merchant", {
                description: error.message || "Database error."
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                {trigger || (
                    <Button className="h-9 gap-2 bg-gray-900 text-white hover:bg-gray-800 border-none shadow-md z-10 transition-all hover:scale-105 active:scale-95">
                        <Plus className="w-4 h-4" /> Add New Merchant
                    </Button>
                )}
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-lg flex flex-col h-full p-0 overflow-hidden">
                {/* Header with Stepper */}
                <div className="px-6 pt-6 pb-4 border-b border-gray-100 bg-white shrink-0">
                    <SheetHeader className="mb-4">
                        <SheetTitle className="text-xl font-bold text-gray-900">New Merchant Onboarding</SheetTitle>
                        <SheetDescription className="text-gray-500">
                            Complete the 3-step verification process.
                        </SheetDescription>
                    </SheetHeader>

                    <OnboardingStepper currentStep={step} steps={STEPS} />
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto px-6 py-6">

                    {/* STEP 1: Basic Info & Map */}
                    {step === 1 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-300">
                            {/* Basic Details Card */}
                            <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                                <div className="flex items-center gap-2 mb-6">
                                    <Store className="w-5 h-5 text-blue-600" />
                                    <h3 className="font-semibold text-gray-900">Basic Details</h3>
                                </div>

                                {/* Single column layout with proper spacing */}
                                <div className="space-y-5">
                                    <div className="space-y-2">
                                        <Label className="text-gray-700 text-sm font-medium">Store Name <span className="text-red-500">*</span></Label>
                                        <Input
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="e.g. Ratnadeep Supermarket"
                                            className="bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500 h-11"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-gray-700 text-sm font-medium">Owner Name <span className="text-red-500">*</span></Label>
                                        <Input
                                            value={formData.ownerName}
                                            onChange={e => setFormData({ ...formData, ownerName: e.target.value })}
                                            placeholder="Full name of the owner"
                                            className="bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500 h-11"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-gray-700 text-sm font-medium">Email Address <span className="text-red-500">*</span></Label>
                                        <Input
                                            type="email"
                                            value={formData.email}
                                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                                            placeholder="owner@example.com"
                                            className="bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500 h-11"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-gray-700 text-sm font-medium">Phone Number <span className="text-red-500">*</span></Label>
                                        <Input
                                            type="tel"
                                            value={formData.phone}
                                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                            placeholder="+91 98765 43210"
                                            className="bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500 h-11"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Location Card */}
                            <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                                <div className="flex items-center gap-2 mb-2">
                                    <MapPin className="w-5 h-5 text-blue-600" />
                                    <h3 className="font-semibold text-gray-900">Store Location</h3>
                                </div>
                                <p className="text-xs text-gray-500 mb-4">Click on the map or drag the pin to mark the exact shop location.</p>

                                <LocationPicker
                                    value={{ lat: formData.latitude, lng: formData.longitude }}
                                    onChange={(lat, lng) => setFormData({ ...formData, latitude: lat, longitude: lng })}
                                />

                                <div className="mt-6 space-y-2">
                                    <Label className="text-gray-700 text-sm font-medium">Full Address</Label>
                                    <Input
                                        value={formData.address}
                                        onChange={e => setFormData({ ...formData, address: e.target.value })}
                                        placeholder="Shop No, Street, Landmark..."
                                        className="bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500 h-11"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: Branches */}
                    {step === 2 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-300">
                            {/* Branch Toggle Card */}
                            <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                                <div className="flex items-start gap-4">
                                    <Checkbox
                                        id="hasBranches"
                                        checked={formData.hasBranches}
                                        onCheckedChange={(c) => setFormData({ ...formData, hasBranches: c as boolean })}
                                        className="mt-1 border-gray-400 data-[state=checked]:bg-blue-600"
                                    />
                                    <div className="flex-1">
                                        <Label htmlFor="hasBranches" className="text-base font-semibold text-gray-900 cursor-pointer">
                                            Does this store have other branches?
                                        </Label>
                                        <p className="text-sm text-gray-500 mt-1">
                                            Check this if the owner manages multiple outlets.
                                        </p>
                                    </div>
                                    <GitBranch className="w-8 h-8 text-gray-300 shrink-0" />
                                </div>
                            </div>

                            {/* Branch Management */}
                            {formData.hasBranches && (
                                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                    <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold text-gray-900">Branch List</h3>
                                            {branches.length > 0 && (
                                                <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">
                                                    {branches.length}
                                                </span>
                                            )}
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-blue-600 border-blue-200 hover:bg-blue-50"
                                            onClick={() => setBranches([...branches, { name: '', location: '' }])}
                                        >
                                            <Plus className="w-4 h-4 mr-1" /> Add Branch
                                        </Button>
                                    </div>

                                    <div className="p-4 space-y-4">
                                        {branches.length === 0 ? (
                                            <div className="text-center py-8">
                                                <GitBranch className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                                                <p className="text-sm text-gray-500">No branches added yet.</p>
                                                <p className="text-xs text-gray-400 mt-1">Click "Add Branch" to get started.</p>
                                            </div>
                                        ) : (
                                            branches.map((branch, i) => (
                                                <div
                                                    key={i}
                                                    className="p-4 bg-gray-50 rounded-lg border border-gray-100 animate-in fade-in duration-200"
                                                >
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <span className="text-sm font-bold text-gray-500">Branch {i + 1}</span>
                                                        <div className="flex-1" />
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8"
                                                            onClick={() => {
                                                                const newB = branches.filter((_, idx) => idx !== i);
                                                                setBranches(newB);
                                                            }}
                                                        >
                                                            <Trash2 className="w-4 h-4 mr-1" /> Remove
                                                        </Button>
                                                    </div>
                                                    <div className="space-y-3">
                                                        <Input
                                                            placeholder="Branch Name (e.g. Jubilee Hills)"
                                                            value={branch.name}
                                                            onChange={e => {
                                                                const newB = [...branches];
                                                                newB[i].name = e.target.value;
                                                                setBranches(newB);
                                                            }}
                                                            className="bg-white h-10"
                                                        />
                                                        <Input
                                                            placeholder="Full Address"
                                                            value={branch.location}
                                                            onChange={e => {
                                                                const newB = [...branches];
                                                                newB[i].location = e.target.value;
                                                                setBranches(newB);
                                                            }}
                                                            className="bg-white h-10"
                                                        />
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Empty state when branches disabled */}
                            {!formData.hasBranches && (
                                <div className="text-center py-16 bg-gray-50 rounded-xl border border-gray-200">
                                    <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                        <Store className="w-8 h-8 text-gray-400" />
                                    </div>
                                    <p className="text-gray-600 font-medium">This merchant operates a single store.</p>
                                    <p className="text-gray-400 text-sm mt-1">Check the box above if multiple branches exist.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 3: KYC */}
                    {step === 3 && (
                        <div className="animate-in fade-in slide-in-from-right-8 duration-300">
                            <KYCForm data={kycData} onChange={setKycData} />
                        </div>
                    )}

                </div>

                {/* Footer */}
                <SheetFooter className="border-t border-gray-200 bg-white px-6 py-4 flex justify-between items-center sm:justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            onClick={handleBack}
                            disabled={step === 1}
                            className="text-gray-600"
                        >
                            <ChevronLeft className="w-4 h-4 mr-1" /> Back
                        </Button>
                        <span className="text-sm text-gray-400">Step {step} of 3</span>
                    </div>

                    {step < 3 ? (
                        <Button
                            onClick={handleNext}
                            disabled={step === 1 && !formData.name}
                            className="bg-gray-900 hover:bg-gray-800 text-white h-10 px-5"
                        >
                            Next Step <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                    ) : (
                        <Button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="bg-gray-900 hover:bg-gray-800 text-white h-10 px-5"
                        >
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                            Verify & Onboard
                        </Button>
                    )}
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
