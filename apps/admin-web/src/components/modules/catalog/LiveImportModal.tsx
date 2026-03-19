import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "../../ui/dialog";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { 
  Search, 
  MapPin, 
  Hash, 
  Zap, 
  Loader2,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';

interface LiveImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncTriggered: (runId: string) => void;
}

export function LiveImportModal({ isOpen, onClose, onSyncTriggered }: LiveImportModalProps) {
  const [queries, setQueries] = useState('');
  const [limit, setLimit] = useState(20);
  const [isLoading, setIsLoading] = useState(false);

  const handleSync = async () => {
    if (!queries.trim()) {
      toast.error('Please enter at least one search query');
      return;
    }

    const queryList = queries.split(',').map(q => q.trim()).filter(q => q.length > 0);
    
    setIsLoading(true);
    try {
      const response = await api.post('/catalog/sync/trigger', {
        queries: queryList,
        location: 'Mumbai',
        limit
      });

      if (response.data.success) {
        toast.success('Live sync started successfully!');
        onSyncTriggered(response.data.runId);
        onClose();
      } else {
        toast.error('Failed to start sync');
      }
    } catch (error: any) {
      console.error('Sync Error:', error);
      toast.error(error.response?.data?.error || 'Failed to trigger Live sync');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[450px] overflow-hidden rounded-2xl border-none shadow-2xl p-0">
        <div className="bg-[#B52725] p-6 text-white relative">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Zap className="w-24 h-24" />
          </div>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <Zap className="w-6 h-6 fill-yellow-400 text-yellow-400" />
            Refresh Import
          </DialogTitle>
          <DialogDescription className="text-red-100 mt-1">
            Pull live product data from our Quick Commerce partner directly into your catalog.
          </DialogDescription>
        </div>

        <div className="p-6 space-y-6 bg-white">
          {/* Queries */}
          {/* Smart Categories */}
           <div className="space-y-3 pb-2 border-b border-gray-100">
             <Label className="text-sm font-bold text-gray-800 flex items-center gap-2">
               <Zap className="w-4 h-4 text-purple-500 fill-purple-500" />
               Smart Bulk Sync (Recommended)
             </Label>
             <p className="text-[11px] text-gray-500 font-medium">Click a category to instantly fetch 600+ top items from that department.</p>
             <div className="flex flex-wrap gap-2">
               {['Medicines', 'Fruits & Vegetables', 'Spices & Masalas', 'Staples & Pulses'].map(cat => (
                 <Button
                    key={cat}
                    variant="outline"
                    size="sm"
                    className="text-xs rounded-full border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100 hover:text-purple-800"
                    onClick={() => setQueries(`[SMART] ${cat}`)}
                 >
                   {cat}
                 </Button>
               ))}
             </div>
           </div>

          {/* Manual Queries */}
          <div className="space-y-2 pt-2">
            <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Search className="w-4 h-4 text-gray-400" />
              Manual Search Keywords
            </Label>
            <Input 
              placeholder="e.g. Amul Milk, Oreo Biscuits, Maggi"
              className="bg-gray-50 border-gray-200 focus:ring-[#B52725] focus:border-[#B52725] rounded-xl"
              value={queries}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQueries(e.target.value)}
            />
            <p className="text-[11px] text-gray-400 font-medium">Separate multiple keywords with commas.</p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Hash className="w-4 h-4 text-gray-400" />
              Limit per query
            </Label>
            <Input 
              type="number"
              min={1}
              max={100}
              className="bg-gray-50 border-gray-200 focus:ring-[#B52725] focus:border-[#B52725] rounded-xl"
              value={limit}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLimit(parseInt(e.target.value))}
            />
            <p className="text-[11px] text-gray-500 font-medium pt-1">
              *Note: The search usually maxes out at <strong>~20 items per keyword</strong>. To get 50+ items, please enter multiple comma-separated keywords above!
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <p className="text-xs text-amber-700 leading-relaxed">
              Scraped products will go to the <strong>Sync Queue</strong> for your final review before joining the Master Catalog.
            </p>
          </div>
        </div>

        <DialogFooter className="p-6 pt-2 bg-gray-50/50">
          <Button variant="ghost" className="rounded-xl font-semibold" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button 
            className="bg-[#B52725] hover:bg-[#8e1d1b] text-white rounded-xl px-8 shadow-lg shadow-red-200 font-bold transition-all hover:scale-105 active:scale-95"
            onClick={handleSync}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Starting...
              </>
            ) : (
              'Start Import'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
