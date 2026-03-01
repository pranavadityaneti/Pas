import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { supabase } from '@/lib/supabaseClient';
import { ChevronLeft, ChevronRight, Loader2, ShieldCheck, MapPin, Store, GitBranch, Plus, Trash2, User } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { OnboardingStepper } from '@/components/onboarding/OnboardingStepper';
import { KYCForm, KYCData } from '@/components/onboarding/KYCForm';
import { LocationPicker } from '@/components/ui/LocationPicker';

const STEPS = [
    { label: 'Identity' },
    { label: 'Store' },
    { label: 'Branches' },
    { label: 'KYC' },
    { label: 'Review' }
];

const STORE_CATEGORIES = [
    'Grocery & Kirana',
    'Supermarket',
    'Restaurant & Cafe',
    'Bakery & Sweets',
    'Pharmacy',
    'Electronics',
    'Fashion & Apparel',
    'Home & Lifestyle',
    'Beauty & Personal Care',
    'Other'
];

interface Branch {
    name: string;
    address: string;
}

export default function SignupWizard() {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    // Step 1: Identity
    const [identity, setIdentity] = useState({
        owner_name: '',
        phone: '',
        email: '',
        password: ''
    });

    // Step 2: Store & Location
    const [storeInfo, setStoreInfo] = useState({
        store_name: '',
        category: '',
        city: 'Hyderabad',
        address: '',
        latitude: 17.3850,
        longitude: 78.4867
    });

    // Step 3: Branches
    const [hasBranches, setHasBranches] = useState(false);
    const [branches, setBranches] = useState<Branch[]>([]);

    // Step 4: KYC
    const [kycData, setKycData] = useState<KYCData>({
        panNumber: '',
        aadharNumber: '',
        bankAccount: '',
        ifsc: '',
        turnoverRange: '<20L',
        msmeNumber: '',
        panDocument: null,
        aadharFront: null,
        aadharBack: null,
        msmeCertificate: null
    });

    // Auto-request location on step 2
    useEffect(() => {
        if (step === 2 && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setStoreInfo(prev => ({
                        ...prev,
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                    }));
                },
                () => { } // Silent fail
            );
        }
    }, [step]);

    const handleNext = () => {
        // Basic validation per step
        if (step === 1) {
            if (!identity.owner_name || !identity.email || !identity.password || !identity.phone) {
                toast.error('Please fill all required fields');
                return;
            }
        }
        if (step === 2) {
            if (!storeInfo.store_name || !storeInfo.category) {
                toast.error('Please enter store name and category');
                return;
            }
        }
        if (step < 5) setStep(step + 1);
        else submitApplication();
    };

    const handleBack = () => {
        if (step > 1) setStep(step - 1);
    };

    const uploadFile = async (file: File, path: string): Promise<string | null> => {
        const { data, error } = await supabase.storage
            .from('merchant-documents')
            .upload(path, file, { upsert: true });

        if (error) {
            console.error('Upload error:', error);
            return null;
        }

        const { data: { publicUrl } } = supabase.storage
            .from('merchant-documents')
            .getPublicUrl(data.path);

        return publicUrl;
    };

    const submitApplication = async () => {
        setLoading(true);
        try {
            // 1. Create Auth User
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: identity.email,
                password: identity.password
            });

            if (authError) throw authError;
            if (!authData.user) throw new Error("Failed to create user");

            const userId = authData.user.id;

            // 2. Upload documents
            let panUrl = null, aadharFrontUrl = null, aadharBackUrl = null, msmeUrl = null;

            if (kycData.panDocument) {
                panUrl = await uploadFile(kycData.panDocument, `${userId}/pan.${kycData.panDocument.name.split('.').pop()}`);
            }
            if (kycData.aadharFront) {
                aadharFrontUrl = await uploadFile(kycData.aadharFront, `${userId}/aadhar_front.${kycData.aadharFront.name.split('.').pop()}`);
            }
            if (kycData.aadharBack) {
                aadharBackUrl = await uploadFile(kycData.aadharBack, `${userId}/aadhar_back.${kycData.aadharBack.name.split('.').pop()}`);
            }
            if (kycData.msmeCertificate) {
                msmeUrl = await uploadFile(kycData.msmeCertificate, `${userId}/msme.${kycData.msmeCertificate.name.split('.').pop()}`);
            }

            // 3. Create Merchant Record
            const { error: dbError } = await supabase
                .from('merchants')
                .insert({
                    id: userId,
                    owner_name: identity.owner_name,
                    store_name: storeInfo.store_name,
                    category: storeInfo.category,
                    email: identity.email,
                    phone: identity.phone,
                    city: storeInfo.city,
                    address: storeInfo.address,
                    latitude: storeInfo.latitude,
                    longitude: storeInfo.longitude,
                    has_branches: hasBranches,
                    status: 'pending',
                    kyc_status: 'pending',
                    pan_number: kycData.panNumber,
                    aadhar_number: kycData.aadharNumber,
                    bank_account_number: kycData.bankAccount,
                    ifsc_code: kycData.ifsc,
                    turnover_range: kycData.turnoverRange,
                    msme_number: kycData.msmeNumber,
                    pan_document_url: panUrl,
                    aadhar_front_url: aadharFrontUrl,
                    aadhar_back_url: aadharBackUrl,
                    msme_certificate_url: msmeUrl
                });

            if (dbError) throw dbError;

            // 4. Create Branch Records (if any)
            if (hasBranches && branches.length > 0) {
                const branchRecords = branches.map(b => ({
                    merchant_id: userId,
                    branch_name: b.name,
                    address: b.address
                }));

                await supabase.from('merchant_branches').insert(branchRecords);
            }

            toast.success("Application Submitted!");
            navigate('/pending-approval');

        } catch (err: any) {
            console.error(err);
            toast.error(err.message || "Submission failed");
        } finally {
            setLoading(false);
        }
    };

    const addBranch = () => {
        setBranches([...branches, { name: '', address: '' }]);
    };

    const removeBranch = (index: number) => {
        setBranches(branches.filter((_, i) => i !== index));
    };

    const updateBranch = (index: number, field: keyof Branch, value: string) => {
        const updated = [...branches];
        updated[index][field] = value;
        setBranches(updated);
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header with Safe Area */}
            <div className="bg-white border-b border-gray-200 px-4 pb-4 pt-14 sticky top-0 z-10">
                <OnboardingStepper currentStep={step} steps={STEPS} />
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 pb-24">
                <Card className="shadow-lg border-0">
                    <CardHeader className="pb-2">
                        <h2 className="text-lg font-bold text-gray-900">
                            {step === 1 && 'Create Your Account'}
                            {step === 2 && 'Store Details'}
                            {step === 3 && 'Branch Information'}
                            {step === 4 && 'KYC & Documents'}
                            {step === 5 && 'Review & Submit'}
                        </h2>
                    </CardHeader>
                    <CardContent className="space-y-4">

                        {/* STEP 1: Identity */}
                        {step === 1 && (
                            <div className="space-y-4 animate-in fade-in duration-300">
                                <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                                    <div className="flex items-center gap-2 mb-4">
                                        <User className="w-5 h-5 text-indigo-600" />
                                        <h3 className="font-semibold text-gray-900">Owner Details</h3>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label>Owner Name <span className="text-red-500">*</span></Label>
                                            <Input
                                                placeholder="John Doe"
                                                value={identity.owner_name}
                                                onChange={e => setIdentity({ ...identity, owner_name: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Phone Number <span className="text-red-500">*</span></Label>
                                            <Input
                                                type="tel"
                                                placeholder="+91 98765 43210"
                                                value={identity.phone}
                                                onChange={e => setIdentity({ ...identity, phone: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Email Address <span className="text-red-500">*</span></Label>
                                            <Input
                                                type="email"
                                                placeholder="owner@store.com"
                                                value={identity.email}
                                                onChange={e => setIdentity({ ...identity, email: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Create Password <span className="text-red-500">*</span></Label>
                                            <Input
                                                type="password"
                                                placeholder="••••••••"
                                                value={identity.password}
                                                onChange={e => setIdentity({ ...identity, password: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* STEP 2: Store & Location */}
                        {step === 2 && (
                            <div className="space-y-4 animate-in fade-in duration-300">
                                <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Store className="w-5 h-5 text-indigo-600" />
                                        <h3 className="font-semibold text-gray-900">Store Information</h3>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label>Store Name <span className="text-red-500">*</span></Label>
                                            <Input
                                                placeholder="My Kirana Store"
                                                value={storeInfo.store_name}
                                                onChange={e => setStoreInfo({ ...storeInfo, store_name: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Store Category <span className="text-red-500">*</span></Label>
                                            <Select
                                                value={storeInfo.category}
                                                onValueChange={(val) => setStoreInfo({ ...storeInfo, category: val })}
                                            >
                                                <SelectTrigger className="bg-white">
                                                    <SelectValue placeholder="Select category" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {STORE_CATEGORIES.map(cat => (
                                                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>City</Label>
                                            <Input
                                                value={storeInfo.city}
                                                onChange={e => setStoreInfo({ ...storeInfo, city: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                                    <div className="flex items-center gap-2 mb-2">
                                        <MapPin className="w-5 h-5 text-indigo-600" />
                                        <h3 className="font-semibold text-gray-900">Store Location</h3>
                                    </div>
                                    <p className="text-xs text-gray-500 mb-4">Tap the map or use the crosshair to set your store location.</p>

                                    <LocationPicker
                                        value={{ lat: storeInfo.latitude, lng: storeInfo.longitude }}
                                        onChange={(lat, lng) => setStoreInfo({ ...storeInfo, latitude: lat, longitude: lng })}
                                    />

                                    <div className="mt-4 space-y-2">
                                        <Label>Full Address</Label>
                                        <Input
                                            placeholder="Shop No, Street, Landmark..."
                                            value={storeInfo.address}
                                            onChange={e => setStoreInfo({ ...storeInfo, address: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* STEP 3: Branches */}
                        {step === 3 && (
                            <div className="space-y-4 animate-in fade-in duration-300">
                                <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                                    <div className="flex items-start gap-3">
                                        <Checkbox
                                            id="hasBranches"
                                            checked={hasBranches}
                                            onCheckedChange={(c) => setHasBranches(c as boolean)}
                                            className="mt-1"
                                        />
                                        <div className="flex-1">
                                            <Label htmlFor="hasBranches" className="text-base font-semibold text-gray-900 cursor-pointer">
                                                Do you have other store branches?
                                            </Label>
                                            <p className="text-sm text-gray-500 mt-1">
                                                Check this if you manage multiple outlets.
                                            </p>
                                        </div>
                                        <GitBranch className="w-8 h-8 text-gray-300" />
                                    </div>
                                </div>

                                {hasBranches && (
                                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                        <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-semibold text-gray-900">Branch List</h3>
                                                {branches.length > 0 && (
                                                    <span className="bg-indigo-100 text-indigo-700 text-xs font-medium px-2 py-0.5 rounded-full">
                                                        {branches.length}
                                                    </span>
                                                )}
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="text-indigo-600 border-indigo-200"
                                                onClick={addBranch}
                                            >
                                                <Plus className="w-4 h-4 mr-1" /> Add Branch
                                            </Button>
                                        </div>

                                        <div className="p-4 space-y-4">
                                            {branches.length === 0 ? (
                                                <div className="text-center py-8">
                                                    <GitBranch className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                                                    <p className="text-sm text-gray-500">No branches added yet.</p>
                                                </div>
                                            ) : (
                                                branches.map((branch, i) => (
                                                    <div key={i} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                                                        <div className="flex items-center justify-between mb-3">
                                                            <span className="text-sm font-bold text-gray-500">Branch {i + 1}</span>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="text-red-500 hover:text-red-600 h-8"
                                                                onClick={() => removeBranch(i)}
                                                            >
                                                                <Trash2 className="w-4 h-4 mr-1" /> Remove
                                                            </Button>
                                                        </div>
                                                        <div className="space-y-3">
                                                            <Input
                                                                placeholder="Branch Name (e.g. Jubilee Hills)"
                                                                value={branch.name}
                                                                onChange={e => updateBranch(i, 'name', e.target.value)}
                                                                className="bg-white"
                                                            />
                                                            <Input
                                                                placeholder="Full Address"
                                                                value={branch.address}
                                                                onChange={e => updateBranch(i, 'address', e.target.value)}
                                                                className="bg-white"
                                                            />
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}

                                {!hasBranches && (
                                    <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
                                        <Store className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                                        <p className="text-gray-600 font-medium">Single Store Operation</p>
                                        <p className="text-gray-400 text-sm mt-1">Enable branches above if needed.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* STEP 4: KYC */}
                        {step === 4 && (
                            <div className="animate-in fade-in duration-300">
                                <KYCForm data={kycData} onChange={setKycData} />
                            </div>
                        )}

                        {/* STEP 5: Review */}
                        {step === 5 && (
                            <div className="space-y-4 animate-in fade-in duration-300">
                                <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                                    <h3 className="font-semibold text-green-800 mb-2">Ready to Submit!</h3>
                                    <p className="text-sm text-green-700">
                                        Please review your details below. Once submitted, our team will verify your application within 24-48 hours.
                                    </p>
                                </div>

                                <div className="bg-gray-50 rounded-xl p-5 border border-gray-200 space-y-3">
                                    <h4 className="font-semibold text-gray-900">Summary</h4>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <span className="text-gray-500">Owner:</span>
                                        <span className="font-medium">{identity.owner_name}</span>
                                        <span className="text-gray-500">Store:</span>
                                        <span className="font-medium">{storeInfo.store_name}</span>
                                        <span className="text-gray-500">Category:</span>
                                        <span className="font-medium">{storeInfo.category}</span>
                                        <span className="text-gray-500">City:</span>
                                        <span className="font-medium">{storeInfo.city}</span>
                                        <span className="text-gray-500">PAN:</span>
                                        <span className="font-medium">{kycData.panNumber || '-'}</span>
                                        <span className="text-gray-500">Bank A/C:</span>
                                        <span className="font-medium">{kycData.bankAccount ? '••••' + kycData.bankAccount.slice(-4) : '-'}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                    </CardContent>
                </Card>
            </div>

            {/* Fixed Footer */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 flex justify-between items-center safe-area-bottom">
                <Button variant="ghost" onClick={handleBack} disabled={step === 1}>
                    <ChevronLeft className="w-4 h-4 mr-1" /> Back
                </Button>

                <span className="text-sm text-gray-400">Step {step} of 5</span>

                <Button
                    onClick={handleNext}
                    disabled={loading}
                    className="bg-indigo-600 hover:bg-indigo-700"
                >
                    {step === 5 ? (
                        loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ShieldCheck className="w-4 h-4 mr-1" /> Submit</>
                    ) : (
                        <>Next <ChevronRight className="w-4 h-4 ml-1" /></>
                    )}
                </Button>
            </div>

            {/* Login Link */}
            <div className="fixed bottom-20 text-center w-full">
                <Button variant="link" className="text-gray-500" onClick={() => navigate('/auth')}>
                    Already have an account? Login
                </Button>
            </div>
        </div>
    );
}
