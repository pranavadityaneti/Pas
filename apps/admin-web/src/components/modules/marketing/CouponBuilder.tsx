import { useState } from 'react';
import { 
  Info,
  CheckCircle2,
  Percent
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { RadioGroup, RadioGroupItem } from '../../ui/radio-group';
import { Checkbox } from '../../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Card, CardContent } from '../../ui/card';
import { Separator } from '../../ui/separator';
import { Badge } from '../../ui/badge';
import { ImageWithFallback } from '../../figma/ImageWithFallback';

export function CouponBuilder() {
  const [promoCode, setPromoCode] = useState('WELCOME50');
  const [discountType, setDiscountType] = useState('percentage');
  const [discountValue, setDiscountValue] = useState('50');
  const [fundingSource, setFundingSource] = useState('platform');
  const [audience, setAudience] = useState(['new']);

  const handleAudienceChange = (value: string) => {
    if (audience.includes(value)) {
      setAudience(audience.filter(item => item !== value));
    } else {
      setAudience([...audience, value]);
    }
  };

  return (
    <div className="flex h-full gap-6">
      {/* Left Panel: The Logic */}
      <div className="flex-1 overflow-auto p-1">
        <Card className="border-gray-200 shadow-sm h-full flex flex-col">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Percent className="w-5 h-5 text-blue-600" />
              Coupon Configuration
            </h3>
            <p className="text-sm text-gray-500 mt-1">Define the rules and limits for this promotion.</p>
          </div>
          
          <div className="p-6 space-y-8 flex-1 overflow-auto">
            {/* Promo Code Input */}
            <div className="space-y-3">
              <Label className="text-base font-semibold text-gray-900">Promo Code</Label>
              <Input 
                value={promoCode} 
                onChange={(e) => setPromoCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
                className="font-mono text-lg uppercase tracking-wider border-gray-300 focus:border-blue-500"
                placeholder="e.g. SUMMER20"
              />
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <Info className="w-3 h-3" /> Max 10 alphanumeric characters.
              </p>
            </div>

            <Separator />

            {/* Discount Logic */}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label className="font-semibold text-gray-900">Discount Type</Label>
                <Select value={discountType} onValueChange={setDiscountType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="flat">Flat Amount (₹)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <Label className="font-semibold text-gray-900">Value</Label>
                <div className="relative">
                  <Input 
                    type="number" 
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="pl-8"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">
                    {discountType === 'percentage' ? '%' : '₹'}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="font-semibold text-gray-900">Max Discount Cap</Label>
              <div className="relative w-1/2">
                <Input type="number" defaultValue="100" className="pl-8" />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">₹</span>
              </div>
              <p className="text-xs text-gray-500">Maximum amount a user can save per order.</p>
            </div>

            <Separator />

            {/* Funding Source - CRITICAL */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Label className="font-semibold text-gray-900 text-base">Funding Source</Label>
                <Badge variant="destructive" className="bg-red-50 text-red-600 border-red-200 hover:bg-red-100">Critical Finance Impact</Badge>
              </div>
              <RadioGroup value={fundingSource} onValueChange={setFundingSource} className="grid grid-cols-2 gap-4">
                <div className={`border rounded-lg p-4 cursor-pointer transition-all ${fundingSource === 'platform' ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600' : 'border-gray-200 hover:border-gray-300'}`}>
                  <RadioGroupItem value="platform" id="platform" className="sr-only" />
                  <Label htmlFor="platform" className="cursor-pointer">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${fundingSource === 'platform' ? 'border-blue-600' : 'border-gray-400'}`}>
                        {fundingSource === 'platform' && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                      </div>
                      <span className="font-bold text-gray-900">Platform Funded</span>
                    </div>
                    <p className="text-sm text-gray-600 pl-6">The company bears the cost of this discount. Used for growth.</p>
                  </Label>
                </div>

                <div className={`border rounded-lg p-4 cursor-pointer transition-all ${fundingSource === 'merchant' ? 'border-purple-600 bg-purple-50/50 ring-1 ring-purple-600' : 'border-gray-200 hover:border-gray-300'}`}>
                  <RadioGroupItem value="merchant" id="merchant" className="sr-only" />
                  <Label htmlFor="merchant" className="cursor-pointer">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${fundingSource === 'merchant' ? 'border-purple-600' : 'border-gray-400'}`}>
                        {fundingSource === 'merchant' && <div className="w-2 h-2 rounded-full bg-purple-600" />}
                      </div>
                      <span className="font-bold text-gray-900">Merchant Funded</span>
                    </div>
                    <p className="text-sm text-gray-600 pl-6">The store bears the cost. Used for clearance/merchant promos.</p>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Separator />

            {/* Audience */}
            <div className="space-y-3">
              <Label className="font-semibold text-gray-900">Target Audience</Label>
              <div className="space-y-3 mt-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="all" 
                    checked={audience.includes('all')}
                    onCheckedChange={() => handleAudienceChange('all')}
                  />
                  <Label htmlFor="all" className="font-normal">All Users</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="new" 
                    checked={audience.includes('new')}
                    onCheckedChange={() => handleAudienceChange('new')}
                  />
                  <Label htmlFor="new" className="font-normal">New Users Only (First Order)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="inactive" 
                    checked={audience.includes('inactive')}
                    onCheckedChange={() => handleAudienceChange('inactive')}
                  />
                  <Label htmlFor="inactive" className="font-normal">Inactive Users ({'>'} 30 Days)</Label>
                </div>
              </div>
            </div>
          </div>
          
          <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 rounded-b-xl">
            <Button variant="outline">Save Draft</Button>
            <Button className="bg-blue-600 hover:bg-blue-700">Launch Campaign</Button>
          </div>
        </Card>
      </div>

      {/* Right Panel: The Preview */}
      <div className="w-[380px] shrink-0 flex flex-col items-center justify-center bg-gray-100 rounded-xl border border-gray-200 p-8 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px]"></div>
        
        <div className="text-center mb-8 z-10">
          <h3 className="text-lg font-bold text-gray-900 mb-1">Mobile App Preview</h3>
          <p className="text-sm text-gray-500">Live preview of the coupon card</p>
        </div>

        {/* Mobile Screen Container */}
        <div className="w-[320px] bg-white rounded-3xl shadow-2xl border-4 border-gray-900 overflow-hidden relative z-10">
          {/* Status Bar */}
          <div className="h-7 bg-gray-900 w-full flex items-center justify-between px-4">
            <div className="text-[10px] text-white font-medium">9:41</div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-white rounded-full opacity-20"></div>
              <div className="w-3 h-3 bg-white rounded-full opacity-20"></div>
              <div className="w-4 h-2.5 border border-white rounded-[2px] opacity-40"></div>
            </div>
          </div>

          {/* App Content */}
          <div className="p-4 bg-gray-50 min-h-[500px]">
            <p className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">Checkout</p>
            
            {/* The Coupon Card */}
            <div className="bg-white rounded-lg border-2 border-dashed border-blue-200 p-4 relative overflow-hidden shadow-sm">
              <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-gray-50 rounded-full"></div>
              <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-gray-50 rounded-full"></div>
              
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                  <Percent className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-gray-900 text-lg">{promoCode || 'CODE'}</h4>
                    <span className="text-blue-600 font-bold text-sm">APPLY</span>
                  </div>
                  <p className="text-sm text-gray-600 font-medium mt-0.5">
                    Get {discountType === 'percentage' ? `${discountValue}%` : `₹${discountValue}`} OFF
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1 line-clamp-1">
                    Max discount ₹100 • {audience.includes('new') ? 'New users only' : 'Valid on all orders'}
                  </p>
                </div>
              </div>
              
              <div className="mt-3 pt-3 border-t border-dashed border-gray-200 flex items-center gap-2">
                <Badge variant="secondary" className="bg-green-100 text-green-700 text-[10px] hover:bg-green-100 h-5 px-1.5 border-none">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Valid
                </Badge>
                <span className="text-[10px] text-gray-400 ml-auto">Expires in 7 days</span>
              </div>
            </div>

            {/* Mock Cart Items to give context */}
            <div className="mt-6 space-y-3 opacity-50 pointer-events-none">
              <div className="h-12 bg-white rounded-lg w-full"></div>
              <div className="h-12 bg-white rounded-lg w-full"></div>
              <div className="h-32 bg-white rounded-lg w-full mt-6"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
