import { useState } from 'react';
import { 
  Download, 
  Filter, 
  Search,
  FileText
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Checkbox } from '../../ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { Card } from '../../ui/card';
import { toast } from 'sonner';

const invoices = [
  { id: 'INV-2025-001', merchant: 'Ratnadeep Supermarket', taxable: 4500, cgst: 405, sgst: 405, total: 5310, date: '15 Jan 2026' },
  { id: 'INV-2025-002', merchant: 'Vijetha Supermarkets', taxable: 2800, cgst: 252, sgst: 252, total: 3304, date: '15 Jan 2026' },
  { id: 'INV-2025-003', merchant: 'Fresh Mart', taxable: 6500, cgst: 585, sgst: 585, total: 7670, date: '31 Dec 2025' },
  { id: 'INV-2025-004', merchant: 'Organic World', taxable: 1200, cgst: 108, sgst: 108, total: 1416, date: '15 Jan 2026' },
  { id: 'INV-2025-005', merchant: 'Good Basket', taxable: 3400, cgst: 306, sgst: 306, total: 4012, date: '15 Jan 2026' },
];

export function InvoiceRepository() {
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [year, setYear] = useState('2025-26');
  const [month, setMonth] = useState('jan');

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedInvoices(invoices.map(i => i.id));
    } else {
      setSelectedInvoices([]);
    }
  };

  const handleSelect = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedInvoices([...selectedInvoices, id]);
    } else {
      setSelectedInvoices(selectedInvoices.filter(i => i !== id));
    }
  };

  const handleDownload = (id: string) => {
    toast.success(`Downloading invoice ${id}`);
  };

  const handleBulkDownload = () => {
    toast.success(`Downloading ${selectedInvoices.length} invoices as ZIP`);
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">GST Invoices</h2>
          <p className="text-sm text-gray-500">Repository of platform fee invoices generated for merchants.</p>
        </div>
        {selectedInvoices.length > 0 && (
          <Button onClick={handleBulkDownload} className="gap-2 animate-in fade-in zoom-in duration-200">
            <Download className="w-4 h-4" />
            Download Selected as Zip
          </Button>
        )}
      </div>

      <Card className="border-gray-200 shadow-sm overflow-hidden flex flex-col flex-1">
        {/* Filters */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Financial Year:</span>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="w-[140px] bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2025-26">2025-26</SelectItem>
                  <SelectItem value="2024-25">2024-25</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Month:</span>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="w-[140px] bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="jan">January</SelectItem>
                  <SelectItem value="feb">February</SelectItem>
                  <SelectItem value="mar">March</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input placeholder="Search Merchant or ID" className="pl-9 bg-white" />
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="bg-gray-50 sticky top-0 z-10">
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox 
                    checked={selectedInvoices.length === invoices.length && invoices.length > 0}
                    onCheckedChange={(checked) => handleSelectAll(!!checked)}
                  />
                </TableHead>
                <TableHead>Invoice ID</TableHead>
                <TableHead className="text-right">Taxable Amt</TableHead>
                <TableHead className="text-right">CGST (9%)</TableHead>
                <TableHead className="text-right">SGST (9%)</TableHead>
                <TableHead className="text-right">Total Amount</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id} className="hover:bg-gray-50/50">
                  <TableCell>
                    <Checkbox 
                      checked={selectedInvoices.includes(inv.id)}
                      onCheckedChange={(checked) => handleSelect(inv.id, !!checked)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{inv.id}</p>
                        <p className="text-xs text-gray-500">{inv.merchant}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-gray-600">₹{inv.taxable.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-gray-600">₹{inv.cgst.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-gray-600">₹{inv.sgst.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-bold text-gray-900">₹{inv.total.toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-gray-500 hover:text-blue-600"
                      onClick={() => handleDownload(inv.id)}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
