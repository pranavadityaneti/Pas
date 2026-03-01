import React, { useEffect, useState } from 'react';
import { Switch } from '@/app/components/ui/switch';
import { Card, CardContent } from '@/app/components/ui/card';
import { Bell, QrCode, TrendingUp, ShoppingBag, Wallet, Loader2 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabaseClient';
import { useNavigate } from 'react-router-dom';

export default function HomeScreen() {
  const [isOnline, setIsOnline] = useState(true);
  const [merchant, setMerchant] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      // 1. Fetch Profile
      const { data: profile } = await supabase
        .from('merchants')
        .select('*')
        .eq('id', user.id)
        .single();

      setMerchant(profile);

      // 2. Fetch Stats
      const { data: statsData } = await supabase.rpc('get_merchant_stats', { merchant_id: user.id });
      if (statsData) setStats(statsData);

    } catch (e) {
      console.error("Error fetching dashboard:", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="h-screen flex items-center justify-center bg-gray-50"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <header className="px-6 py-4 bg-white border-b border-gray-100 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Switch
            checked={isOnline}
            onCheckedChange={setIsOnline}
            className="data-[state=checked]:bg-green-500"
          />
          <span className={cn(
            "text-sm font-semibold transition-colors",
            isOnline ? "text-green-600" : "text-gray-400"
          )}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="relative" onClick={() => supabase.auth.signOut().then(() => navigate('/auth'))}>
            <span className="sr-only">Logout</span>
            <span className="text-xs font-semibold text-gray-500">Logout</span>
          </Button>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="w-6 h-6 text-gray-600" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
          </Button>
        </div>
      </header>

      <div className="p-6 space-y-6 flex-1 overflow-y-auto">
        {/* Welcome */}
        <div>
          <h2 className="text-xl font-bold text-gray-900">Good Morning, {merchant?.owner_name?.split(' ')[0]}</h2>
          <p className="text-sm text-gray-500">{merchant?.store_name} • {merchant?.city}</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-4">
          <Card className="bg-gradient-to-br from-blue-600 to-blue-700 text-white border-none shadow-lg">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">Monthly GMV</p>
                <h3 className="text-3xl font-bold mt-1">₹{stats?.gmv_30d?.toLocaleString() || 0}</h3>
                <div className="flex items-center gap-1 mt-2 text-blue-200 text-xs">
                  <TrendingUp className="w-3 h-3" />
                  <span>30 Day Revenue</span>
                </div>
              </div>
              <div className="bg-white/20 p-3 rounded-full">
                <Wallet className="w-6 h-6 text-white" />
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <Card className="border-none shadow-sm bg-white">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="bg-orange-100 p-2 rounded-md">
                    <ShoppingBag className="w-4 h-4 text-orange-600" />
                  </div>
                  <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">Live</span>
                </div>
                <h4 className="text-2xl font-bold text-gray-900">{stats?.orders_30d || 0}</h4>
                <p className="text-xs text-gray-500">Total Orders</p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="bg-green-100 p-2 rounded-md">
                    <Wallet className="w-4 h-4 text-green-600" />
                  </div>
                  <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Avg</span>
                </div>
                <h4 className="text-2xl font-bold text-gray-900">₹{Math.round(stats?.avg_order_value || 0)}</h4>
                <p className="text-xs text-gray-500">Ticket Size</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Recent Activity or Placeholder */}
        <div className="pt-2">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-4">
            <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-2 border-dashed border-2">
              <span className="text-2xl">+</span>
              <span className="text-xs">Add Product</span>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-2 border-dashed border-2">
              <span className="text-xl">📄</span>
              <span className="text-xs">Reports</span>
            </Button>
          </div>
        </div>
      </div>

      {/* FAB */}
      <div className="fixed bottom-24 right-6 z-40">
        <Button
          size="lg"
          className="rounded-full h-14 w-14 shadow-xl bg-gray-900 hover:bg-gray-800 p-0 flex items-center justify-center"
        >
          <QrCode className="w-6 h-6 text-white" />
        </Button>
      </div>
    </div>
  );
}
