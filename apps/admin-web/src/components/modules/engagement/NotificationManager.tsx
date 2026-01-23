import { useState } from 'react';
import { 
  Bell, 
  Send, 
  Calendar, 
  Smartphone,
  Info
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { Card, CardContent } from '../../ui/card';
import { RadioGroup, RadioGroupItem } from '../../ui/radio-group';
import { Label } from '../../ui/label';
import { toast } from 'sonner';
import { Separator } from '../../ui/separator';

export function NotificationManager() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('all');
  const [schedule, setSchedule] = useState('now');

  const handleSend = () => {
    toast.success('Campaign Scheduled', {
      description: `Sending "${title}" to ${audience === 'all' ? 'All Users' : 'Targeted Segment'}`
    });
    // Reset form
    setTitle('');
    setBody('');
  };

  return (
    <div className="flex h-full gap-6">
      {/* Left Panel: Campaign Builder */}
      <div className="flex-1 overflow-auto p-1">
        <Card className="border-gray-200 shadow-sm h-full flex flex-col">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Bell className="w-5 h-5 text-blue-600" />
                Push Campaign Builder
              </h3>
              <p className="text-sm text-gray-500 mt-1">Send notifications to wake up users.</p>
            </div>
            <Button onClick={handleSend} className="bg-blue-600 hover:bg-blue-700 gap-2">
              <Send className="w-4 h-4" />
              {schedule === 'now' ? 'Send Blast' : 'Schedule Campaign'}
            </Button>
          </div>
          
          <div className="p-6 space-y-8 flex-1 overflow-auto">
            {/* Message Content */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-base font-semibold text-gray-900">Notification Title</Label>
                <Input 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Flash Sale! 50% Off Chai"
                  className="font-medium"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-base font-semibold text-gray-900">Message Body</Label>
                <Textarea 
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="e.g. It's raining! Get hot snacks delivered in 10 mins..."
                  className="h-24 resize-none"
                />
                <p className="text-xs text-gray-500 text-right">
                  {body.length}/120 characters recommended
                </p>
              </div>

              <div className="space-y-2">
                <Label className="font-semibold text-gray-900">Deep Link (Optional)</Label>
                <Input placeholder="e.g. /store/ratnadeep-banjara" />
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Info className="w-3 h-3" /> Where should the user land when they tap?
                </p>
              </div>
            </div>

            <Separator />

            {/* Target Audience */}
            <div className="space-y-4">
              <Label className="text-base font-semibold text-gray-900">Target Audience</Label>
              <Select value={audience} onValueChange={setAudience}>
                <SelectTrigger>
                  <SelectValue placeholder="Select audience" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users (Broadcast)</SelectItem>
                  <SelectItem value="city_hyd">Users in Hyderabad</SelectItem>
                  <SelectItem value="city_blr">Users in Bangalore</SelectItem>
                  <SelectItem value="inactive_30">Inactive for &gt; 30 Days</SelectItem>
                  <SelectItem value="churn_risk">Churn Risk (AI Segment)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Scheduling */}
            <div className="space-y-4">
              <Label className="text-base font-semibold text-gray-900">Scheduling</Label>
              <RadioGroup value={schedule} onValueChange={setSchedule} className="grid grid-cols-2 gap-4">
                <div className={`border rounded-lg p-4 cursor-pointer transition-all ${schedule === 'now' ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600' : 'border-gray-200 hover:border-gray-300'}`}>
                  <RadioGroupItem value="now" id="now" className="sr-only" />
                  <Label htmlFor="now" className="cursor-pointer">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${schedule === 'now' ? 'border-blue-600' : 'border-gray-400'}`}>
                        {schedule === 'now' && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                      </div>
                      <span className="font-bold text-gray-900">Send Immediately</span>
                    </div>
                    <p className="text-sm text-gray-600 pl-6">Blast will start processing within 30 seconds.</p>
                  </Label>
                </div>

                <div className={`border rounded-lg p-4 cursor-pointer transition-all ${schedule === 'later' ? 'border-purple-600 bg-purple-50/50 ring-1 ring-purple-600' : 'border-gray-200 hover:border-gray-300'}`}>
                  <RadioGroupItem value="later" id="later" className="sr-only" />
                  <Label htmlFor="later" className="cursor-pointer">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${schedule === 'later' ? 'border-purple-600' : 'border-gray-400'}`}>
                        {schedule === 'later' && <div className="w-2 h-2 rounded-full bg-purple-600" />}
                      </div>
                      <span className="font-bold text-gray-900">Schedule for Later</span>
                    </div>
                    <p className="text-sm text-gray-600 pl-6">Pick a date and time for optimized delivery.</p>
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        </Card>
      </div>

      {/* Right Panel: Preview */}
      <div className="w-[380px] shrink-0 flex flex-col items-center justify-center bg-gray-100 rounded-xl border border-gray-200 p-8 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px]"></div>
        
        <div className="text-center mb-8 z-10">
          <h3 className="text-lg font-bold text-gray-900 mb-1">Preview</h3>
          <p className="text-sm text-gray-500">How it looks on iOS Lock Screen</p>
        </div>

        {/* Mobile Screen Container */}
        <div className="w-[320px] bg-[url('https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center rounded-3xl shadow-2xl border-4 border-gray-900 overflow-hidden relative z-10 h-[600px]">
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>

          {/* Status Bar */}
          <div className="relative z-20 h-7 w-full flex items-center justify-between px-4 mt-2">
            <div className="text-[12px] text-white font-medium">9:41</div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-white rounded-full opacity-80"></div>
              <div className="w-3 h-3 bg-white rounded-full opacity-80"></div>
              <div className="w-4 h-2.5 border border-white rounded-[2px] opacity-80"></div>
            </div>
          </div>

          {/* Time */}
          <div className="relative z-20 text-center mt-8 text-white/90">
             <div className="text-6xl font-light tracking-tighter">9:41</div>
             <div className="text-lg font-medium mt-1">Wednesday, 21 January</div>
          </div>

          {/* Notification Card */}
          <div className="relative z-20 mx-3 mt-8">
            <div className="bg-white/90 backdrop-blur-md rounded-xl p-3 shadow-lg animate-in slide-in-from-top-4 duration-500">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center shrink-0 shadow-sm">
                   <div className="text-white font-bold text-xs">Pick</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-semibold text-gray-900 text-sm">PickAtStore</span>
                    <span className="text-xs text-gray-500">now</span>
                  </div>
                  <h4 className="font-semibold text-gray-900 text-sm truncate pr-2">
                    {title || 'Flash Sale! 50% Off'}
                  </h4>
                  <p className="text-sm text-gray-700 leading-snug line-clamp-3">
                    {body || "It's raining outside! Get hot snacks and chai delivered in 10 minutes. Tap to order now."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}