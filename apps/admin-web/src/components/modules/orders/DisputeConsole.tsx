import { ArrowLeft, Check, X, Flag, AlertTriangle } from 'lucide-react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Separator } from '../../ui/separator';
import { ScrollArea } from '../../ui/scroll-area';
import { ImageWithFallback } from '../../figma/ImageWithFallback';

interface DisputeConsoleProps {
  id: string;
  onBack: () => void;
  onResolve: (result: string) => void;
}

export function DisputeConsole({ id, onBack, onResolve }: DisputeConsoleProps) {
  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="h-16 border-b border-gray-200 px-6 flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-3">
              Dispute #{id}: Price Mismatch
              <Badge variant="destructive" className="bg-orange-100 text-orange-700 hover:bg-orange-100 border-orange-200">
                High Priority
              </Badge>
            </h2>
          </div>
        </div>
        <div className="text-sm text-gray-500">
          Opened 45 mins ago by Customer
        </div>
      </div>

      {/* Main Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: User Evidence */}
        <div className="w-1/2 border-r border-gray-200 flex flex-col bg-gray-50/50">
          <div className="p-4 border-b border-gray-200 bg-white">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
              User Evidence
            </h3>
            <p className="text-sm text-gray-500 mt-1">Uploaded 45 mins ago via Mobile App</p>
          </div>
          
          <ScrollArea className="flex-1 p-6">
            <div className="space-y-6">
              <div className="rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
                <div className="relative aspect-[4/3] w-full bg-black/5">
                  <ImageWithFallback 
                    src="https://images.unsplash.com/photo-1710383934725-0895f9f20298?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxncm9jZXJ5JTIwcHJvZHVjdCUyMHN1cGVybWFya2V0JTIwc2hlbGYlMjBwcmljZSUyMHRhZ3xlbnwxfHx8fDE3Njg5ODM1NDN8MA&ixlib=rb-4.1.0&q=80&w=1080"
                    alt="User Uploaded Evidence"
                    className="object-cover w-full h-full"
                  />
                  <div className="absolute bottom-4 left-4 bg-black/75 text-white px-3 py-1.5 rounded-lg text-sm font-medium backdrop-blur-sm">
                    User Claim: ₹35
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <h4 className="font-medium text-gray-900 mb-2">Customer Statement</h4>
                <p className="text-gray-600 text-sm leading-relaxed">
                  "The shelf price clearly says 35 rupees but I was charged 40 in the app. Please refund the difference."
                </p>
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* Right Panel: System Data */}
        <div className="w-1/2 flex flex-col bg-white">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <span className="w-2 h-2 bg-gray-900 rounded-full"></span>
              System Data
            </h3>
            <p className="text-sm text-gray-500 mt-1">Database Record ID: #PRD-8821</p>
          </div>

          <ScrollArea className="flex-1 p-6">
            <div className="space-y-6">
              <div className="flex gap-6">
                <div className="w-32 h-32 rounded-lg border border-gray-200 overflow-hidden shrink-0">
                  <ImageWithFallback 
                    src="https://images.unsplash.com/photo-1555910114-d4ba95cc20e2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtaWxrJTIwY2FydG9uJTIwcHJvZHVjdCUyMHdoaXRlJTIwYmFja2dyb3VuZHxlbnwxfHx8fDE3Njg5ODM1NDN8MA&ixlib=rb-4.1.0&q=80&w=1080"
                    alt="System Product Image"
                    className="object-cover w-full h-full"
                  />
                </div>
                <div className="flex-1">
                  <h4 className="text-xl font-bold text-gray-900">Fresh Farm Milk (1L)</h4>
                  <p className="text-gray-500 text-sm">Brand: MilkyWay | EAN: 890123456789</p>
                  
                  <div className="mt-4 flex items-center gap-8">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">System Price</p>
                      <p className="text-2xl font-bold text-gray-900">₹40.00</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Last Updated</p>
                      <p className="text-sm font-medium text-gray-700">Yesterday, 14:00</p>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-yellow-900">Merchant Comment</h4>
                    <p className="text-yellow-700 text-sm mt-1">
                      "We updated the price in the system yesterday but the shelf tag might be old. The customer is probably right about the tag."
                    </p>
                    <p className="text-xs text-yellow-600 mt-2 font-medium">- Store Manager, 10 mins ago</p>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-6 border-t border-gray-200 bg-gray-50 flex items-center justify-between shrink-0">
        <div className="text-sm text-gray-500">
          Make a decision to close this ticket. This action is irreversible.
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
            onClick={() => onResolve("Fraud Flagged")}
          >
            <Flag className="w-4 h-4 mr-2" />
            Flag User as Fraud
          </Button>
          <Button 
            variant="outline"
            className="bg-white"
            onClick={() => onResolve("Claim Rejected")}
          >
            <X className="w-4 h-4 mr-2" />
            Reject Claim
          </Button>
          <Button 
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={() => onResolve("Claim Accepted (Refund Issued)")}
          >
            <Check className="w-4 h-4 mr-2" />
            Accept User Claim
          </Button>
        </div>
      </div>
    </div>
  );
}
