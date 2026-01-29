import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/app/components/ui/button';
import { MapPin, Building2, ChevronDown } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select" // I need to create this or use native select

// I'll use a native select for simplicity and speed if I didn't create the Select component.
// But wait, standard UI patterns usually imply custom selects. 
// I haven't created Select component yet. I should use native select or create the component.
// I'll create a simple native select styled nicely.

export default function BranchSelectScreen() {
  const navigate = useNavigate();
  const [branch, setBranch] = useState('');

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (branch) {
      navigate('/');
    }
  };

  const branches = [
    { id: '1', name: 'Downtown Store (Main)', address: '123 Market St' },
    { id: '2', name: 'Westside Mall Outlet', address: 'Westside Mall, Lvl 2' },
    { id: '3', name: 'Airport Kiosk', address: 'Terminal 3, Dep' },
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-white">
      <div className="w-full max-w-xs space-y-8">
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-4">
            <Building2 className="w-6 h-6 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Select Branch</h1>
          <p className="text-sm text-muted-foreground">
            Which store are you managing today?
          </p>
        </div>

        <form onSubmit={handleContinue} className="space-y-6">
          <div className="relative">
            <select
              className="flex h-12 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              required
            >
              <option value="" disabled>Select a branch...</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-4 h-4 w-4 opacity-50 pointer-events-none" />
          </div>

          {branch && (
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-gray-500 mt-1" />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {branches.find(b => b.id === branch)?.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {branches.find(b => b.id === branch)?.address}
                  </p>
                </div>
              </div>
            </div>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={!branch}>
            Continue to Dashboard
          </Button>
        </form>
      </div>
    </div>
  );
}
