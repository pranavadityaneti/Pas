import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Progress } from '@/app/components/ui/progress';
import { Textarea } from '@/app/components/ui/textarea';
import { supabase } from '@/lib/supabaseClient';
import { Check, ChevronLeft, ChevronRight, Loader2, Upload } from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const STEPS = [
    { id: 1, title: 'Identity', desc: 'Create your account' },
    { id: 2, title: 'Store', desc: 'Business details' },
    { id: 3, title: 'KYC', desc: 'Legal documents' }
];

export default function SignupWizard() {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    // Form State
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        owner_name: '',
        phone: '',
        store_name: '',
        city: 'Hyderabad', // Defaulting for MVP
        address: '',
        pan_number: '',
        gstin: ''
    });

    const handleNext = async () => {
        if (step < 3) {
            setStep(step + 1);
        } else {
            await submitApplication();
        }
    };

    const handleBack = () => {
        if (step > 1) setStep(step - 1);
    };

    const submitApplication = async () => {
        setLoading(true);
        try {
            // 1. Create Auth User
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password
            });

            if (authError) throw authError;
            if (!authData.user) throw new Error("Failed to create user");

            const userId = authData.user.id;

            // 2. Create Merchant Record
            // We use the same ID as Auth ID (Linked)
            const { error: dbError } = await supabase
                .from('merchants')
                .insert({
                    id: userId,
                    owner_name: formData.owner_name,
                    store_name: formData.store_name,
                    email: formData.email,
                    phone: formData.phone,
                    city: formData.city,
                    address: formData.address,
                    status: 'pending',
                    kyc_status: 'pending',
                    role: 'MERCHANT'
                    // Note: pan_number, gstin would go into a separate sensitive table or fields if schema supports it.
                    // For now assuming they are part of the 'merchants' table or we just store them to verify.
                    // If columns don't exist yet, we might get an error, but assuming schema is aligned.
                });

            if (dbError) throw dbError;

            toast.success("Application Submitted Successfully!");

            // Auto sign in happens on signUp often if email confirm is off, 
            // if email confirm is on, they need to verify. 
            // Assuming dev mode (no verify).
            navigate('/pending-approval');

        } catch (err: any) {
            console.error(err);
            toast.error(err.message || "Submission failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-2xl shadow-xl">
                <CardHeader>
                    <div className="flex justify-between items-center mb-4">
                        <CardTitle>Partner Application</CardTitle>
                        <span className="text-sm text-gray-500">Step {step} of 3</span>
                    </div>
                    <Progress value={(step / 3) * 100} className="h-2" />
                </CardHeader>
                <CardContent className="py-6">

                    {/* Step 1: Identity */}
                    {step === 1 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Owner Name</Label>
                                    <Input
                                        placeholder="John Doe"
                                        value={formData.owner_name}
                                        onChange={e => setFormData({ ...formData, owner_name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Phone Number</Label>
                                    <Input
                                        placeholder="+91 98765 43210"
                                        value={formData.phone}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Email Address</Label>
                                <Input
                                    type="email"
                                    placeholder="store@gmail.com"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Create Password</Label>
                                <Input
                                    type="password"
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                />
                            </div>
                        </div>
                    )}

                    {/* Step 2: Store Details */}
                    {step === 2 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="space-y-2">
                                <Label>Store Name</Label>
                                <Input
                                    placeholder="My Kirana Store"
                                    value={formData.store_name}
                                    onChange={e => setFormData({ ...formData, store_name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>City</Label>
                                <Input
                                    value={formData.city}
                                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Full Address</Label>
                                <Textarea
                                    placeholder="Shop No. 12, Main Road..."
                                    value={formData.address}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                />
                            </div>
                        </div>
                    )}

                    {/* Step 3: KYC */}
                    {step === 3 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg text-sm text-amber-800">
                                Info: For this demo, we will skip actual file upload logic and just capture the ID numbers.
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>PAN Number</Label>
                                    <Input
                                        placeholder="ABCDE1234F"
                                        value={formData.pan_number}
                                        onChange={e => setFormData({ ...formData, pan_number: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>GSTIN (Optional)</Label>
                                    <Input
                                        placeholder="22AAAAA0000A1Z5"
                                        value={formData.gstin}
                                        onChange={e => setFormData({ ...formData, gstin: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-gray-50 transition-colors">
                                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                                    <Upload className="w-6 h-6 text-gray-400" />
                                </div>
                                <p className="font-medium text-gray-900">Upload Shop License / Registration</p>
                                <p className="text-xs text-gray-500 mt-1">PNG, JPG or PDF up to 5MB</p>
                            </div>
                        </div>
                    )}

                </CardContent>
                <CardFooter className="flex justify-between">
                    <Button variant="outline" onClick={handleBack} disabled={step === 1}>
                        <ChevronLeft className="w-4 h-4 mr-1" /> Back
                    </Button>
                    <Button onClick={handleNext} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">
                        {step === 3 ? (
                            loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Application'
                        ) : (
                            <>Next <ChevronRight className="w-4 h-4 ml-1" /></>
                        )}
                    </Button>
                </CardFooter>
            </Card>

            <div className="fixed bottom-4 text-center w-full">
                <Button variant="link" className="text-gray-500" onClick={() => navigate('/auth')}>
                    Already have an account? Login
                </Button>
            </div>
        </div>
    );
}
