import { useState } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/card';
import { Separator } from '../../ui/separator';
import { toast } from 'sonner';
import { Save, Lock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';

export function GlobalConfig() {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const handleSave = () => {
    setIsConfirmOpen(true);
  };

  const confirmSave = () => {
    setIsConfirmOpen(false);
    toast.success('Configuration Updated', {
      description: 'Global variables have been propagated to all services.'
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Global Platform Variables</h2>
          <p className="text-sm text-gray-500">The "Switchboard" for critical operational parameters.</p>
        </div>
        <Button onClick={handleSave} className="bg-[#121212] hover:bg-[#2d2d2d] gap-2">
          <Save className="w-4 h-4" /> Save Changes
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Order Limits */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Order Limits</CardTitle>
            <CardDescription>Constraints for cart and payments.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Max COD Amount (₹)</Label>
              <Input defaultValue="2000" type="number" />
              <p className="text-xs text-gray-500">Orders above this must use online payment.</p>
            </div>
            <div className="space-y-2">
              <Label>Min Order Value (₹)</Label>
              <Input defaultValue="100" type="number" />
              <p className="text-xs text-gray-500">Minimum cart value to checkout.</p>
            </div>
          </CardContent>
        </Card>

        {/* Fees & Commissions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fees & Commissions</CardTitle>
            <CardDescription>Base charges applied globally.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Platform Fee (₹)</Label>
              <Input defaultValue="2" type="number" />
            </div>
            <div className="space-y-2">
              <Label>Base Delivery Fare (₹)</Label>
              <Input defaultValue="30" type="number" />
            </div>
          </CardContent>
        </Card>

        {/* Referral System */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Referral System</CardTitle>
            <CardDescription>Rewards for user growth.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Referrer Bonus (₹)</Label>
              <Input defaultValue="50" type="number" />
              <p className="text-xs text-gray-500">Credited to the person who invites.</p>
            </div>
            <div className="space-y-2">
              <Label>Referee Bonus (₹)</Label>
              <Input defaultValue="50" type="number" />
              <p className="text-xs text-gray-500">Credited to the new user.</p>
            </div>
          </CardContent>
        </Card>

        {/* Logistics */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Logistics Constraints</CardTitle>
            <CardDescription>Delivery radius and timing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Max Service Radius (km)</Label>
              <Input defaultValue="5" type="number" />
            </div>
            <div className="space-y-2">
              <Label>Driver Assignment Timeout (sec)</Label>
              <Input defaultValue="45" type="number" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Lock className="w-5 h-5" /> Security Check
            </DialogTitle>
            <DialogDescription>
              Changing global variables affects the entire platform immediately. Please confirm your password to proceed.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Admin Password</Label>
            <Input type="password" placeholder="Enter password" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmOpen(false)}>Cancel</Button>
            <Button onClick={confirmSave} className="bg-red-600 hover:bg-red-700">Confirm Change</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}