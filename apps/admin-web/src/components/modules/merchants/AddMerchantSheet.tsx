import { useState } from 'react';
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
import { Loader2, Plus, ChevronRight, ChevronLeft, ShieldCheck, Trash2 } from 'lucide-react';
import { LocationPicker } from '../../ui/location-picker';
import { KYCForm, KYCData } from './onboarding/KYCForm';
import { Checkbox } from '../../ui/checkbox';

interface AddMerchantSheetProps {
    trigger?: React.ReactNode;
}

export function AddMerchantSheet({ trigger }: AddMerchantSheetProps) {
    const { createMerchant } = useMerchants();
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

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

    const handleNext = () => setStep(p => p + 1);
    const handleBack = () => setStep(p => p - 1);

    const handleSubmit = async () => {
        try {
            setIsSubmitting(true);

            // Combine all data
            const payload = {
                ...formData,
                branches,
                kyc: kycData
            };

            console.log("Submitting Payload to Supabase:", payload);

            await createMerchant(payload);

            toast.success(`Merchant "${formData.name}" onboarded successfully!`);
            setOpen(false);
            setStep(1); // Reset
            // Reset form data if needed
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
                    <Button className="h-9 gap-2 bg-black text-white hover:bg-gray-800 border-none shadow-md z-10 transition-all hover:scale-105 active:scale-95">
                        <Plus className="w-4 h-4" /> Add New Merchant
                    </Button>
                )}
            </SheetTrigger>
            <SheetContent className="w-[800px] sm:w-[800px] flex flex-col h-full">
                <SheetHeader className="mb-4">
                    <SheetTitle>New Merchant Onboarding</SheetTitle>
                    <SheetDescription>
                        Complete the 3-step verification process.
                    </SheetDescription>
                    {/* Stepper */}
                    <div className="flex items-center gap-2 mt-4 text-sm font-medium">
                        <div className={`px-3 py-1 rounded-full ${step >= 1 ? 'bg-black text-white' : 'bg-gray-100 text-gray-400'}`}>1. Store Info</div>
                        <div className="h-px w-8 bg-gray-200" />
                        <div className={`px-3 py-1 rounded-full ${step >= 2 ? 'bg-black text-white' : 'bg-gray-100 text-gray-400'}`}>2. Branches</div>
                        <div className="h-px w-8 bg-gray-200" />
                        <div className={`px-3 py-1 rounded-full ${step >= 3 ? 'bg-black text-white' : 'bg-gray-100 text-gray-400'}`}>3. KYC & Docs</div>
                    </div>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto pr-2 pb-20 p-1">

                    {/* STEP 1: Basic Info & Map */}
                    {step === 1 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-300 p-4">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label>Store Name *</Label>
                                    <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Ratnadeep" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Owner Name *</Label>
                                    <Input value={formData.ownerName} onChange={e => setFormData({ ...formData, ownerName: e.target.value })} placeholder="Full Name" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label>Email *</Label>
                                    <Input value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="owner@gmail.com" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Phone *</Label>
                                    <Input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="+91..." />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Select Location *</Label>
                                <p className="text-xs text-gray-500 mb-2">Drag pin to exact shop entrance.</p>
                                <LocationPicker
                                    value={{ lat: formData.latitude, lng: formData.longitude }}
                                    onChange={(lat, lng) => setFormData({ ...formData, latitude: lat, longitude: lng })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Full Address</Label>
                                <Input value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="Shop No, Street, Landmark..." />
                            </div>
                        </div>
                    )}

                    {/* STEP 2: Branches */}
                    {step === 2 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-300 p-4">
                            <div className="flex items-center space-x-4 border p-6 rounded-lg bg-gray-50">
                                <Checkbox id="hasBranches" checked={formData.hasBranches} onCheckedChange={(c) => setFormData({ ...formData, hasBranches: c as boolean })} />
                                <div className="grid gap-1.5 leading-none">
                                    <Label htmlFor="hasBranches" className="text-base font-semibold">
                                        Does this store have other branches?
                                    </Label>
                                    <p className="text-sm text-gray-500">
                                        Check this if the owner manages multiple outlets.
                                    </p>
                                </div>
                            </div>

                            {formData.hasBranches && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <h3 className="font-medium">Branch List</h3>
                                        <Button size="sm" variant="outline" onClick={() => setBranches([...branches, { name: '', location: '' }])}>+ Add Branch</Button>
                                    </div>
                                    {branches.map((branch, i) => (
                                        <div key={i} className="flex gap-4 items-center">
                                            <span className="text-sm font-bold w-6">{i + 1}.</span>
                                            <Input placeholder="Branch Name" value={branch.name} onChange={e => {
                                                const newB = [...branches]; newB[i].name = e.target.value; setBranches(newB);
                                            }} />
                                            <Input placeholder="Location" value={branch.location} onChange={e => {
                                                const newB = [...branches]; newB[i].location = e.target.value; setBranches(newB);
                                            }} />
                                            <Button size="icon" variant="ghost" className="text-red-500" onClick={() => {
                                                const newB = branches.filter((_, idx) => idx !== i); setBranches(newB);
                                            }}><Trash2 className="w-4 h-4" /></Button>
                                        </div>
                                    ))}
                                    {branches.length === 0 && <p className="text-sm text-gray-400 italic">No branches added yet.</p>}
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 3: KYC */}
                    {step === 3 && (
                        <div className="p-4">
                            <KYCForm data={kycData} onChange={setKycData} />
                        </div>
                    )}

                </div>

                <SheetFooter className="absolute bottom-0 left-0 right-0 bg-white p-4 border-t border-gray-100 flex justify-between items-center sm:justify-between z-20">
                    <Button variant="ghost" onClick={handleBack} disabled={step === 1}>
                        <ChevronLeft className="w-4 h-4 mr-2" /> Back
                    </Button>

                    {step < 3 ? (
                        <Button onClick={handleNext} disabled={step === 1 && !formData.name}>
                            Next Step <ChevronRight className="w-4 h-4 ml-2" />
                        </Button>
                    ) : (
                        <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-green-600 hover:bg-green-700 text-white">
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                            Verify & Onboard
                        </Button>
                    )}
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
