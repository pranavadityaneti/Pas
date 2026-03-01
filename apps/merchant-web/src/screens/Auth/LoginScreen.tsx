import React, { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/app/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/app/components/ui/tabs';
import { Label } from '@/app/components/ui/label';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { Loader2, Store } from 'lucide-react';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user }, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;
      if (!user) throw new Error('No user found');

      // Check Merchant Status
      const { data: merchant, error: merchantError } = await supabase
        .from('merchants')
        .select('status, kyc_status')
        .eq('id', user.id)
        .single();

      if (merchantError && merchantError.code !== 'PGRST116') {
        // PGRST116 = JSON object requested, multiple (or no) rows returned.
        // If real error, throw
        throw merchantError;
      }

      // If no merchant record but auth exists, they might be in mid-signup or broken state
      if (!merchant) {
        toast.error("Account exists but no Merchant Profile found.");
        return;
      }

      // Gatekeeper Logic
      if (merchant.status === 'pending') {
        navigate('/pending-approval');
      } else if (merchant.status === 'rejected') {
        navigate('/application-rejected');
      } else if (merchant.status === 'active') {
        navigate('/dashboard');
      } else {
        navigate('/dashboard'); // Default
      }

    } catch (err: any) {
      toast.error(err.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-t-4 border-t-indigo-600">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
            <Store className="w-6 h-6 text-indigo-600" />
          </div>
          <CardTitle className="text-2xl">Merchant Portal</CardTitle>
          <CardDescription>Manage your store, orders, and inventory</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="store@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button className="w-full bg-indigo-600 hover:bg-indigo-700" type="submit" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Access Dashboard
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-500 mb-3">New to Pick At Store?</p>
            <Button
              variant="outline"
              className="w-full border-indigo-200 text-indigo-600 hover:bg-indigo-50"
              onClick={() => navigate('/signup')}
            >
              Apply as Merchant Partner
            </Button>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center border-t p-4 bg-gray-50/50">
          <p className="text-xs text-center text-gray-500">
            Protected by Pick At Store Secure Gateway
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
