import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/app/components/ui/card';
import { supabase } from '@/lib/supabaseClient';
import { CheckCircle, Clock, Loader2, RefreshCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export default function PendingApproval() {
    const [checking, setChecking] = useState(false);
    const navigate = useNavigate();

    const checkStatus = async () => {
        setChecking(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                navigate('/auth');
                return;
            }

            const { data: merchant } = await supabase
                .from('merchants')
                .select('status, kyc_status')
                .eq('id', user.id)
                .single();

            if (merchant?.status === 'active') {
                toast.success("You are approved!");
                navigate('/dashboard');
            } else if (merchant?.status === 'rejected') {
                navigate('/application-rejected');
            } else {
                toast.info("Still pending review. Please check back later.");
            }
        } catch (e) {
            toast.error("Error checking status");
        } finally {
            setChecking(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md text-center shadow-lg">
                <CardHeader>
                    <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
                        <Clock className="w-8 h-8 text-yellow-600" />
                    </div>
                    <CardTitle className="text-xl">Application Under Review</CardTitle>
                    <CardDescription>
                        Thanks for applying directly to the Merchant Network.
                        Our admin team is currently verifying your KYC documents.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-700 mb-6">
                        <p className="font-semibold mb-1">What happens next?</p>
                        <p>Usually takes 24-48 hours. You will receive an email once your store is live.</p>
                    </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-3">
                    <Button variant="outline" className="w-full" onClick={checkStatus} disabled={checking}>
                        {checking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                        Check Status
                    </Button>
                    <Button variant="ghost" className="w-full text-gray-500" onClick={() => supabase.auth.signOut().then(() => navigate('/auth'))}>
                        Sign Out
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
