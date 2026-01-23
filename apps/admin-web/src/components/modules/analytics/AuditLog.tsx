import { 
  ShieldAlert, 
  Search, 
  Filter, 
  Download 
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';
import { Badge } from '../../ui/badge';

const logs = [
  { id: 1, time: '21 Jan, 10:42 AM', user: 'Admin: Rahul', action: 'Changed Commission for Store #102 from 10% to 12%', ip: '192.168.1.55', severity: 'medium' },
  { id: 2, time: '21 Jan, 10:30 AM', user: 'Admin: Rahul', action: 'Approved Merchant #455 (Fresh Mart)', ip: '192.168.1.55', severity: 'low' },
  { id: 3, time: '21 Jan, 09:15 AM', user: 'System', action: 'Failed Login Attempt (User: admin@pickatstore.com)', ip: '45.22.12.99', severity: 'high' },
  { id: 4, time: '20 Jan, 11:00 PM', user: 'Admin: Sneha', action: 'Triggered Batch Settlement #9001', ip: '172.16.0.2', severity: 'high' },
  { id: 5, time: '20 Jan, 04:20 PM', user: 'Admin: Sneha', action: 'Updated Global Config: Max COD = 2000', ip: '172.16.0.2', severity: 'medium' },
];

export function AuditLog() {
  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Security Audit Trail</h2>
          <p className="text-sm text-gray-500">Monitor sensitive actions and system changes.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" /> Export Logs
          </Button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col flex-1 overflow-hidden">
        {/* Filters */}
        <div className="p-4 border-b border-gray-100 flex items-center gap-4 bg-gray-50/50">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input placeholder="Search logs..." className="pl-9 bg-white" />
          </div>
          <Button variant="outline" className="gap-2 bg-white">
            <Filter className="w-4 h-4" /> Filter
          </Button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="bg-gray-50 sticky top-0 z-10">
              <TableRow>
                <TableHead className="w-[180px]">Timestamp</TableHead>
                <TableHead className="w-[150px]">User</TableHead>
                <TableHead>Action Details</TableHead>
                <TableHead className="w-[150px]">IP Address</TableHead>
                <TableHead className="w-[100px] text-right">Severity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id} className="hover:bg-gray-50">
                  <TableCell className="text-gray-500 font-mono text-xs">{log.time}</TableCell>
                  <TableCell className="font-medium text-gray-900">{log.user}</TableCell>
                  <TableCell className="text-gray-700">{log.action}</TableCell>
                  <TableCell className="text-gray-500 font-mono text-xs">{log.ip}</TableCell>
                  <TableCell className="text-right">
                    <SeverityBadge level={log.severity} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function SeverityBadge({ level }: { level: string }) {
  const styles = {
    high: 'bg-red-100 text-red-700 border-red-200',
    medium: 'bg-orange-100 text-orange-700 border-orange-200',
    low: 'bg-blue-100 text-blue-700 border-blue-200',
  };

  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border uppercase tracking-wide ${styles[level as keyof typeof styles]}`}>
      {level}
    </span>
  );
}