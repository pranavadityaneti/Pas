import { useState, useEffect } from 'react';
import {
  Check,
  X,
  ZoomIn,
  ZoomOut,
  FileText,
  User,
  MapPin,
  Loader2,
  Trash2
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Textarea } from '../../ui/textarea';
import { Checkbox } from '../../ui/checkbox';
import { Label } from '../../ui/label';
import { ScrollArea } from '../../ui/scroll-area';
import { ImageWithFallback } from '../../figma/ImageWithFallback';
import { toast } from 'sonner';
import { useMerchants, Merchant } from '../../../hooks/useMerchants';
import { formatDistanceToNow } from 'date-fns';

export function KYCQueue() {
  const { merchants, updateMerchant, deleteMerchant, loading } = useMerchants();
  const [selectedApp, setSelectedApp] = useState<Merchant | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [activeDoc, setActiveDoc] = useState<'pan' | 'aadhar_front' | 'aadhar_back' | 'gst' | 'store_1' | 'store_2'>('pan');
  const [rejectionReason, setRejectionReason] = useState('');

  const [checklist, setChecklist] = useState({
    nameMatch: false,
    validDoc: false,
    clearPhoto: false,
    addressMatch: false,
  });

  const pendingApplications = merchants.filter(m => m.kyc_status === 'pending');

  // Select first app on load if none selected, or clear if deleted
  useEffect(() => {
    if (pendingApplications.length === 0) {
      setSelectedApp(null);
    } else if (!selectedApp || !pendingApplications.find(a => a.id === selectedApp.id)) {
      setSelectedApp(pendingApplications[0]);
    }
  }, [merchants]);

  // Reset checklist when selection changes
  useEffect(() => {
    setChecklist({ nameMatch: false, validDoc: false, clearPhoto: false, addressMatch: false });
    setRejectionReason('');
    setZoomLevel(1);
    setActiveDoc('pan');
  }, [selectedApp?.id]);

  const handleDecision = async (decision: 'approve' | 'reject') => {
    if (!selectedApp) return;

    try {
      if (decision === 'approve') {
        await updateMerchant(selectedApp.id, {
          kyc_status: 'approved',
          status: 'active'
        });
        toast.success(`Application Approved`, { description: `${selectedApp.store_name} is now active.` });
      } else {
        await updateMerchant(selectedApp.id, {
          kyc_status: 'rejected',
          kyc_rejection_reason: rejectionReason
        });
        toast.error(`Application Rejected`, { description: `${selectedApp.store_name} has been notified.` });
      }
    } catch (error) {
      console.error("Decision failed", error);
    }
  };

  const getActiveDocUrl = () => {
    if (!selectedApp) return null;
    switch (activeDoc) {
      case 'pan': return selectedApp.pan_doc_url;
      case 'aadhar_front': return selectedApp.aadhar_front_url;
      case 'aadhar_back': return selectedApp.aadhar_back_url;
      case 'gst': return selectedApp.gst_certificate_url;
      case 'store_1': return selectedApp.store_photos?.[0];
      case 'store_2': return selectedApp.store_photos?.[1];
      default: return null;
    }
  };

  if (loading && !selectedApp) {
    return (
      <div className="h-[calc(100vh-220px)] flex items-center justify-center bg-white border border-gray-200 rounded-lg">
        <Loader2 className="w-8 h-8 animate-spin text-[#B52725]" />
        <span className="ml-2 text-gray-500">Loading requests...</span>
      </div>
    );
  }

  if (pendingApplications.length === 0) {
    return (
      <div className="h-[calc(100vh-220px)] flex flex-col items-center justify-center bg-white border border-gray-200 rounded-lg text-center p-8">
        <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">All Caught Up!</h3>
        <p className="text-gray-500 mt-2 max-w-sm">There are no pending merchant applications to review at the moment.</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-220px)] border border-gray-200 rounded-lg bg-white overflow-hidden shadow-sm">
      {/* Column 1: Queue List */}
      <div className="w-1/4 border-r border-gray-200 bg-gray-50 flex flex-col min-w-[250px]">
        <div className="p-4 border-b border-gray-200 bg-white">
          <h3 className="font-semibold text-gray-900">Verification Queue</h3>
          <p className="text-xs text-gray-500">{pendingApplications.length} Pending Requests</p>
        </div>
        <ScrollArea className="flex-1">
          <div className="divide-y divide-gray-200">
            {pendingApplications.map((app) => (
              <button
                key={app.id}
                onClick={() => setSelectedApp(app)}
                className={`w-full text-left p-4 hover:bg-white transition-colors flex items-start justify-between group ${selectedApp?.id === app.id ? 'bg-white border-l-4 border-l-blue-600 shadow-sm' : 'border-l-4 border-l-transparent'
                  }`}
              >
                <div>
                  <p className={`font-medium text-sm truncate max-w-[140px] ${selectedApp?.id === app.id ? 'text-blue-700' : 'text-gray-900'}`}>
                    {app.store_name}
                  </p>
                  <p className="text-xs text-gray-500 mt-1 truncate max-w-[140px]">{app.owner_name}</p>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {app.created_at && formatDistanceToNow(new Date(app.created_at), { addSuffix: true }).replace('about ', '')}
                </span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Column 2: Document Viewer */}
      {selectedApp && (
        <>
          <div className="flex-1 bg-gray-100 flex flex-col relative overflow-hidden">
            <div className="absolute top-4 left-4 z-10 flex gap-2">
              <button
                onClick={() => setActiveDoc('pan')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm transition-all border ${activeDoc === 'pan' ? 'bg-black/80 text-white border-black' : 'bg-white/80 text-gray-700 border-gray-200 hover:bg-white'
                  }`}
              >
                PAN Card
              </button>
              <button
                onClick={() => setActiveDoc('aadhar_front')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm transition-all border ${activeDoc === 'aadhar_front' ? 'bg-black/80 text-white border-black' : 'bg-white/80 text-gray-700 border-gray-200 hover:bg-white'
                  }`}
              >
                Aadhar Front
              </button>
              <button
                onClick={() => setActiveDoc('aadhar_back')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm transition-all border ${activeDoc === 'aadhar_back' ? 'bg-black/80 text-white border-black' : 'bg-white/80 text-gray-700 border-gray-200 hover:bg-white'
                  }`}
              >
                Aadhar Back
              </button>
              {selectedApp.gst_certificate_url && (
                <button
                  onClick={() => setActiveDoc('gst')}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm transition-all border ${activeDoc === 'gst' ? 'bg-black/80 text-white border-black' : 'bg-white/80 text-gray-700 border-gray-200 hover:bg-white'
                    }`}
                >
                  GST Cert
                </button>
              )}
              {selectedApp.store_photos?.[0] && (
                <button
                  onClick={() => setActiveDoc('store_1')}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm transition-all border ${activeDoc === 'store_1' ? 'bg-black/80 text-white border-black' : 'bg-white/80 text-gray-700 border-gray-200 hover:bg-white'
                    }`}
                >
                  Store 1
                </button>
              )}
              {selectedApp.store_photos?.[1] && (
                <button
                  onClick={() => setActiveDoc('store_2')}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm transition-all border ${activeDoc === 'store_2' ? 'bg-black/80 text-white border-black' : 'bg-white/80 text-gray-700 border-gray-200 hover:bg-white'
                    }`}
                >
                  Store 2
                </button>
              )}
            </div>

            <div className="flex-1 flex items-center justify-center p-8 overflow-auto">
              <div
                className="bg-white shadow-2xl transition-transform duration-200 ease-in-out"
                style={{ transform: `scale(${zoomLevel})` }}
              >
                {getActiveDocUrl() ? (
                  <ImageWithFallback
                    src={getActiveDocUrl()!}
                    alt="Document"
                    className="max-w-[600px] h-auto object-contain"
                  />
                ) : (
                  <div className="w-[400px] h-[300px] flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 bg-gray-50">
                    <FileText className="w-12 h-12 mb-2 opacity-20" />
                    <p className="text-sm">No document uploaded</p>
                  </div>
                )}
              </div>
            </div>

            {/* Zoom Controls */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur border border-gray-200 rounded-full shadow-lg flex items-center p-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.1))}>
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-xs font-medium w-12 text-center">{Math.round(zoomLevel * 100)}%</span>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setZoomLevel(Math.min(2, zoomLevel + 0.1))}>
                <ZoomIn className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Column 3: Checklist & Decision */}
          <div className="w-[340px] border-l border-gray-200 bg-white relative min-w-[340px] shrink-0 h-full overflow-hidden">
            {/* Header - Fixed Top */}
            <div className="absolute top-0 left-0 right-0 h-[57px] px-3 py-3 border-b border-gray-200 bg-gray-50/50 z-10 box-border">
              <h3 className="font-semibold text-gray-900 text-sm">Review Application</h3>
              <p className="text-[11px] text-gray-500 truncate">Verify details for {selectedApp.store_name}</p>
            </div>

            {/* Content - Scrollable Middle Area */}
            <div className="absolute top-[57px] bottom-[110px] left-0 right-0 overflow-y-auto p-3 scrollbar-none bg-white">
              {/* Metadata - Ultra Compact */}
              <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm mb-3">
                <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-2 text-xs items-center">
                  <User className="w-3 h-3 text-gray-400" />
                  <div className="font-medium text-gray-900">{selectedApp.owner_name}</div>

                  <MapPin className="w-3 h-3 text-gray-400" />
                  <div className="text-gray-600 truncate" title={selectedApp.address}>{selectedApp.city}</div>

                  <FileText className="w-3 h-3 text-gray-400" />
                  <div className="flex gap-2 flex-wrap">
                    <span className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px] font-mono border border-gray-200" title="PAN">
                      {selectedApp.pan_number || 'No PAN'}
                    </span>
                    <span className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px] font-mono border border-gray-200" title="Aadhar">
                      {selectedApp.aadhar_number || 'No Aadhar'}
                    </span>
                    {selectedApp.gst_number && (
                      <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-mono border border-blue-100" title="GSTIN">
                        {selectedApp.gst_number}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Detailed Business Info */}
              <div className="space-y-3 mb-4">
                <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Business Compliance</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center bg-gray-50/50 p-1.5 rounded">
                      <span className="text-[11px] text-gray-500">GSTIN</span>
                      <span className="text-[11px] font-semibold text-gray-900">{selectedApp.gst_number || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center bg-gray-50/50 p-1.5 rounded">
                      <span className="text-[11px] text-gray-500">Turnover</span>
                      <span className="text-[11px] font-semibold text-gray-900">{selectedApp.turnover_range || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Payout & Bank</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center bg-gray-50/50 p-1.5 rounded">
                      <span className="text-[11px] text-gray-500">Account</span>
                      <span className="text-[11px] font-mono font-semibold text-gray-900">{selectedApp.bank_account_number || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center bg-gray-50/50 p-1.5 rounded">
                      <span className="text-[11px] text-gray-500">IFSC</span>
                      <span className="text-[11px] font-mono font-semibold text-gray-900">{selectedApp.ifsc_code || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Application Meta</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-gray-500 italic">Submitted</span>
                      <span className="text-[11px] text-gray-600">
                        {selectedApp.created_at ? new Date(selectedApp.created_at).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Checklist - Compact */}
              <div className="space-y-2 mb-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-semibold text-gray-900 uppercase tracking-wider">Verification</h4>
                  <span className="text-[10px] text-gray-400">{Object.values(checklist).filter(Boolean).length}/4</span>
                </div>

                <div className="bg-gray-50 rounded border border-gray-100 p-2 space-y-2">
                  {[
                    { id: 'name', label: 'Name Match', state: checklist.nameMatch, set: (c: boolean) => setChecklist(p => ({ ...p, nameMatch: c })) },
                    { id: 'valid', label: 'Valid Docs', state: checklist.validDoc, set: (c: boolean) => setChecklist(p => ({ ...p, validDoc: c })) },
                    { id: 'clear', label: 'Clear Photo', state: checklist.clearPhoto, set: (c: boolean) => setChecklist(p => ({ ...p, clearPhoto: c })) },
                    { id: 'addr', label: 'Address Match', state: checklist.addressMatch, set: (c: boolean) => setChecklist(p => ({ ...p, addressMatch: c })) },
                  ].map(item => (
                    <div key={item.id} className="flex items-center gap-2">
                      <Checkbox
                        id={item.id}
                        checked={item.state}
                        onCheckedChange={(c) => item.set(c as boolean)}
                        className="h-3.5 w-3.5 rounded-[2px]"
                      />
                      <Label htmlFor={item.id} className="text-xs text-gray-700 cursor-pointer select-none flex-1">{item.label}</Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Comment Box */}
              <div className="space-y-1">
                <Label htmlFor="comment" className="text-[11px] font-medium text-gray-500">Rejection Note</Label>
                <Textarea
                  id="comment"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Reason..."
                  className="resize-none h-14 text-xs min-h-[50px] py-1.5"
                />
              </div>
            </div>

            {/* Footer - Fixed Bottom */}
            <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 space-y-2 z-10 h-[150px] box-border">
              <Button
                className="w-full bg-green-600 hover:bg-green-700 text-white shadow-sm h-9 text-xs"
                disabled={!Object.values(checklist).every(Boolean)}
                onClick={() => handleDecision('approve')}
              >
                <Check className="w-3.5 h-3.5 mr-2" />
                Approve Store
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 h-9 text-xs"
                  disabled={!rejectionReason && checklist.nameMatch} // Require reason if rejecting
                  onClick={() => handleDecision('reject')}
                >
                  <X className="w-3.5 h-3.5 mr-2" />
                  Reject
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="px-3 text-gray-400 hover:text-red-600 hover:bg-red-50 h-9"
                  onClick={() => {
                    if (confirm(`Are you sure you want to PERMANENTLY delete the application for ${selectedApp.store_name}?`)) {
                      deleteMerchant(selectedApp.id);
                    }
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
