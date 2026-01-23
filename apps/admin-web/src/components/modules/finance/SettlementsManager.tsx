import { useState } from 'react';
import { 
  CheckCircle2, 
  FileText, 
  AlertCircle,
  Download,
  Filter,
  Calendar,
  Search,
  ArrowUpRight
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import { Card } from '../../ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { toast } from 'sonner';

const settlements = [
  { 
    id: 1, 
    merchant: 'Ratnadeep Supermarket', 
    cycle: '1 Jan - 15 Jan', 
    orders: 145, 
    gmv: 50000, 
    commission: 5000, 
    net: 45000, 
    status: 'due' 
  },
  { 
    id: 2, 
    merchant: 'Vijetha Supermarkets', 
    cycle: '1 Jan - 15 Jan', 
    orders: 89, 
    gmv: 32000, 
    commission: 3200, 
    net: 28800, 
    status: 'due' 
  },
  { 
    id: 3, 
    merchant: 'Organic World', 
    cycle: '1 Jan - 15 Jan', 
    orders: 12, 
    gmv: 4500, 
    commission: 450, 
    net: 4050, 
    status: 'on_hold',
    reason: 'Bank Details Pending'
  },
  { 
    id: 4, 
    merchant: 'Fresh Mart', 
    cycle: '16 Dec - 31 Dec', 
    orders: 200, 
    gmv: 75000, 
    commission: 7500, 
    net: 67500, 
    status: 'paid',
    paidDate: '2 Jan 2026'
  },
];

export function SettlementsManager() {
  const [activeTab, setActiveTab] = useState('due');

  const getFilteredSettlements = () => {
    return settlements.filter(s => {
      if (activeTab === 'due') return s.status === 'due';
      if (activeTab === 'paid') return s.status === 'paid';
      if (activeTab === 'hold') return s.status === 'on_hold';
      return true;
    });
  };

  const filteredData = getFilteredSettlements();
  const totalPending = settlements
    .filter(s => s.status === 'due')
    .reduce((acc, curr) => acc + curr.net, 0);

  const handleSettle = (id: number) => {
    toast.success('Settlement Processed', {
      description: `Payment initiated for Settlement ID #${id}`
    });
  };

  return (
    <div className="h-full flex flex-col relative">
      <div className="p-6 pb-0 flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Merchant Settlements</h2>
          <p className="text-sm text-gray-500">Manage payouts and financial reconciliation.</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700 gap-2">
          <ArrowUpRight className="w-4 h-4" />
          Run Batch Payout
        </Button>
      </div>

      <div className="flex-1 px-6 pb-20 overflow-hidden flex flex-col">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="w-[400px] mb-4">
            <TabsTrigger value="due" className="flex-1">Due (Active)</TabsTrigger>
            <TabsTrigger value="paid" className="flex-1">Paid History</TabsTrigger>
            <TabsTrigger value="hold" className="flex-1">On Hold</TabsTrigger>
          </TabsList>

          <Card className="flex-1 border-gray-200 shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-auto flex-1">
              <Table>
                <TableHeader className="bg-gray-50 sticky top-0 z-10">
                  <TableRow>
                    <TableHead>Merchant Name</TableHead>
                    <TableHead>Cycle Date</TableHead>
                    <TableHead className="text-right">Total Orders</TableHead>
                    <TableHead className="text-right">Total GMV</TableHead>
                    <TableHead className="text-right">Comm. Deducted</TableHead>
                    <TableHead className="text-right">Net Payable</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((item) => (
                    <TableRow key={item.id} className="hover:bg-gray-50/50">
                      <TableCell className="font-medium text-gray-900">
                        {item.merchant}
                        {item.status === 'on_hold' && (
                          <div className="text-xs text-red-500 flex items-center gap-1 mt-1">
                            <AlertCircle className="w-3 h-3" /> {item.reason}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-600">{item.cycle}</TableCell>
                      <TableCell className="text-right text-gray-600">{item.orders}</TableCell>
                      <TableCell className="text-right font-medium">₹{item.gmv.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-red-600">-₹{item.commission.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <span className="font-bold text-green-600 text-lg">
                          ₹{item.net.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {item.status === 'due' ? (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-blue-600 border-blue-200 hover:bg-blue-50"
                            onClick={() => handleSettle(item.id)}
                          >
                            Mark Settled
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" className="text-gray-500">
                            View Breakdown
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </Tabs>
      </div>

      {/* Summary Footer */}
      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 px-6 flex items-center justify-between shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <InfoIcon />
          <span>Payouts are processed via Nodal Account ending in ****8899</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-gray-600 font-medium">Total Pending Payouts:</span>
          <span className="text-2xl font-bold text-gray-900">₹{(totalPending / 100000).toFixed(2)} Lakhs</span>
        </div>
      </div>
    </div>
  );
}

function InfoIcon() {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="16" 
      height="16" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className="w-4 h-4"
    >
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 16v-4"/>
      <path d="M12 8h.01"/>
    </svg>
  );
}
