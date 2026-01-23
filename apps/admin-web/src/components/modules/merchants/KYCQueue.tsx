import { useState } from 'react';
import { 
  Check, 
  X, 
  ZoomIn, 
  ZoomOut, 
  FileText, 
  User, 
  MapPin, 
  Calendar,
  ChevronRight
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Checkbox } from '../../ui/checkbox';
import { Label } from '../../ui/label';
import { ScrollArea } from '../../ui/scroll-area';
import { Separator } from '../../ui/separator';
import { ImageWithFallback } from '../../figma/ImageWithFallback';
import { toast } from 'sonner';

const applications = [
  { id: 1, store: 'Kirana King', owner: 'Rajesh Kumar', status: 'pending', date: '2 hrs ago', docType: 'PAN Card' },
  { id: 2, store: 'Laxmi General Store', owner: 'Laxmi Devi', status: 'pending', date: '4 hrs ago', docType: 'GST Certificate' },
  { id: 3, store: 'Urban Needs', owner: 'Amit Shah', status: 'pending', date: '1 day ago', docType: 'FSSAI License' },
  { id: 4, store: 'Quick Mart', owner: 'John Doe', status: 'reviewing', date: '1 day ago', docType: 'Aadhar Card' },
];

export function KYCQueue() {
  const [selectedApp, setSelectedApp] = useState(applications[0]);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [checklist, setChecklist] = useState({
    nameMatch: false,
    validDoc: false,
    clearPhoto: false,
    addressMatch: false,
  });

  const handleDecision = (decision: 'approve' | 'reject') => {
    toast[decision === 'approve' ? 'success' : 'error'](
      `Application ${decision === 'approve' ? 'Approved' : 'Rejected'}`, 
      { description: `${selectedApp.store} has been notified.` }
    );
    // Reset for demo
    setChecklist({ nameMatch: false, validDoc: false, clearPhoto: false, addressMatch: false });
  };

  return (
    <div className="flex h-[calc(100vh-220px)] border border-gray-200 rounded-lg bg-white overflow-hidden shadow-sm">
      {/* Column 1: Queue List */}
      <div className="w-1/4 border-r border-gray-200 bg-gray-50 flex flex-col">
        <div className="p-4 border-b border-gray-200 bg-white">
          <h3 className="font-semibold text-gray-900">Verification Queue</h3>
          <p className="text-xs text-gray-500">{applications.length} Pending Requests</p>
        </div>
        <ScrollArea className="flex-1">
          <div className="divide-y divide-gray-200">
            {applications.map((app) => (
              <button
                key={app.id}
                onClick={() => setSelectedApp(app)}
                className={`w-full text-left p-4 hover:bg-white transition-colors flex items-start justify-between group ${
                  selectedApp.id === app.id ? 'bg-white border-l-4 border-l-blue-600 shadow-sm' : 'border-l-4 border-l-transparent'
                }`}
              >
                <div>
                  <p className={`font-medium text-sm ${selectedApp.id === app.id ? 'text-blue-700' : 'text-gray-900'}`}>
                    {app.store}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{app.docType}</p>
                </div>
                <span className="text-xs text-gray-400">{app.date}</span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Column 2: Document Viewer */}
      <div className="flex-1 bg-gray-100 flex flex-col relative overflow-hidden">
        <div className="absolute top-4 left-4 z-10 bg-black/75 text-white px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm">
          Viewing: {selectedApp.docType}
        </div>
        
        <div className="flex-1 flex items-center justify-center p-8 overflow-auto">
          <div 
            className="bg-white shadow-2xl transition-transform duration-200 ease-in-out"
            style={{ transform: `scale(${zoomLevel})` }}
          >
            <ImageWithFallback
              src="https://images.unsplash.com/photo-1764025851210-9ad5ed83e01f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkb2N1bWVudCUyMHBhcGVyd29yayUyMGRlc2t8ZW58MXx8fHwxNzY4OTgzNTQzfDA&ixlib=rb-4.1.0&q=80&w=1080"
              alt="Document"
              className="max-w-[600px] h-auto object-contain"
            />
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
      <div className="w-[320px] border-l border-gray-200 bg-white flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Review Application</h3>
          <p className="text-xs text-gray-500">Verify details carefully</p>
        </div>

        <ScrollArea className="flex-1 p-6">
          {/* Metadata */}
          <div className="space-y-4 mb-6">
            <div className="bg-blue-50 p-3 rounded-lg flex items-start gap-3">
              <User className="w-4 h-4 text-blue-600 mt-0.5" />
              <div>
                <p className="text-xs text-blue-600 font-medium">Applicant Name</p>
                <p className="text-sm font-bold text-blue-900">{selectedApp.owner}</p>
              </div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg flex items-start gap-3">
              <MapPin className="w-4 h-4 text-gray-600 mt-0.5" />
              <div>
                <p className="text-xs text-gray-600 font-medium">Store Location</p>
                <p className="text-sm font-medium text-gray-900">Sector 4, HSR Layout</p>
              </div>
            </div>
          </div>

          <Separator className="mb-6" />

          {/* Checklist */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Verification Checklist</h4>
            
            <div className="flex items-center space-x-3">
              <Checkbox 
                id="name" 
                checked={checklist.nameMatch}
                onCheckedChange={(c) => setChecklist({...checklist, nameMatch: c as boolean})}
              />
              <Label htmlFor="name" className="text-sm font-normal">Name Matches Document</Label>
            </div>
            
            <div className="flex items-center space-x-3">
              <Checkbox 
                id="valid" 
                checked={checklist.validDoc}
                onCheckedChange={(c) => setChecklist({...checklist, validDoc: c as boolean})}
              />
              <Label htmlFor="valid" className="text-sm font-normal">Document is Valid (Not Expired)</Label>
            </div>

            <div className="flex items-center space-x-3">
              <Checkbox 
                id="clear" 
                checked={checklist.clearPhoto}
                onCheckedChange={(c) => setChecklist({...checklist, clearPhoto: c as boolean})}
              />
              <Label htmlFor="clear" className="text-sm font-normal">Photo/Scan is Clear</Label>
            </div>

            <div className="flex items-center space-x-3">
              <Checkbox 
                id="address" 
                checked={checklist.addressMatch}
                onCheckedChange={(c) => setChecklist({...checklist, addressMatch: c as boolean})}
              />
              <Label htmlFor="address" className="text-sm font-normal">Address Matches Store Record</Label>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Comment Box */}
          <div className="space-y-2">
            <Label htmlFor="comment" className="text-sm font-medium">Reviewer Comments</Label>
            <Textarea 
              id="comment" 
              placeholder="Enter reason for rejection or additional notes..." 
              className="resize-none h-24 text-sm"
            />
          </div>
        </ScrollArea>

        {/* Action Buttons */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 space-y-3">
          <Button 
            className="w-full bg-green-600 hover:bg-green-700 text-white shadow-sm"
            disabled={!Object.values(checklist).every(Boolean)}
            onClick={() => handleDecision('approve')}
          >
            <Check className="w-4 h-4 mr-2" />
            Approve Store
          </Button>
          <Button 
            variant="outline" 
            className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
            onClick={() => handleDecision('reject')}
          >
            <X className="w-4 h-4 mr-2" />
            Reject Application
          </Button>
        </div>
      </div>
    </div>
  );
}
