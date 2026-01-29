import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { supabase } from '@/lib/supabaseClient';
import { AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ApplicationRejected() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md text-center shadow-lg border-t-4 border-t-red-500">
                <CardHeader>
                    <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                        <AlertCircle className="w-8 h-8 text-red-600" />
                    </div>
                    <CardTitle className="text-xl text-red-700">Application Rejected</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-gray-600 mb-6">
                        Unfortunately, your application for the Merchant Network was not approved by our compliance team.
                    </p>
                    <div className="bg-gray-100 p-4 rounded text-left text-sm mb-6">
                        <p className="font-bold text-gray-700 mb-1">Reason:</p>
                        <p className="text-gray-600">Document verificaton failed. Please ensure uploaded IDs are clear and match the owner info.</p>
                    </div>
                    <Button className="w-full" onClick={() => navigate('/signup')}>
                        Re-apply
                    </Button>
                    <div className="mt-4">
                        <Button variant="link" className="text-red-600" onClick={() => supabase.auth.signOut().then(() => navigate('/auth'))}>
                            Sign Out
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
