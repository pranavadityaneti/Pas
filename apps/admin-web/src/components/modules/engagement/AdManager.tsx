import { useState } from 'react';
import {
  Megaphone,
  Plus,
  TrendingUp,
  MoreHorizontal,
  PauseCircle,
  PlayCircle
} from 'lucide-react';
import { Button } from '../../ui/button';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { toast } from 'sonner';

const initialAds = [
  { id: 1, merchant: 'Ratnadeep Supermarket', position: 'Home Page Top', start: '20 Jan 2026', end: '25 Jan 2026', status: 'active', impressions: 15400, cost: 5000 },
  { id: 2, merchant: 'Vijetha Supermarkets', position: 'Search Result #1', start: '18 Jan 2026', end: '22 Jan 2026', status: 'active', impressions: 8200, cost: 2500 },
  { id: 3, merchant: 'Organic World', position: 'Category Banner', start: '01 Jan 2026', end: '15 Jan 2026', status: 'completed', impressions: 45000, cost: 12000 },
];

export function AdManager() {
  const [ads, setAds] = useState(initialAds);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleCreate = () => {
    toast.success('Ad Campaign Created', {
      description: 'The boosted slot has been reserved.'
    });
    setIsModalOpen(false);
  };

  const toggleStatus = (id: number) => {
    setAds(ads.map(ad => {
      if (ad.id === id) {
        const newStatus = ad.status === 'active' ? 'paused' : 'active';
        toast.info(`Campaign ${newStatus === 'active' ? 'Resumed' : 'Paused'}`);
        return { ...ad, status: newStatus };
      }
      return ad;
    }));
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Sponsored Listings & Ads</h2>
          <p className="text-sm text-gray-500">Manage paid visibility slots for merchants.</p>
        </div>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#121212] hover:bg-[#2d2d2d] gap-2">
              <Plus className="w-4 h-4" /> Create Boost
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Sponsored Slot</DialogTitle>
              <DialogDescription>
                Boost a merchant's visibility on the platform.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Merchant Name</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select merchant" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="m1">Ratnadeep Supermarket</SelectItem>
                    <SelectItem value="m2">Vijetha Supermarkets</SelectItem>
                    <SelectItem value="m3">Fresh Mart</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Slot Position</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select position" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="home_top">Home Page Top (Premium)</SelectItem>
                    <SelectItem value="search_1">Search Result #1</SelectItem>
                    <SelectItem value="cat_banner">Category Banner</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Duration (Days)</Label>
                  <Input type="number" defaultValue="7" />
                </div>
                <div className="space-y-2">
                  <Label>Cost (₹)</Label>
                  <Input type="number" defaultValue="5000" />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} className="bg-[#121212] hover:bg-[#2d2d2d]">Launch Campaign</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-gray-200 shadow-sm overflow-hidden flex flex-col flex-1">
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="bg-gray-50 sticky top-0 z-10">
              <TableRow>
                <TableHead>Merchant</TableHead>
                <TableHead>Slot Position</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead className="text-right">Impressions</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ads.map((ad) => (
                <TableRow key={ad.id} className="hover:bg-gray-50/50">
                  <TableCell className="font-medium text-gray-900">{ad.merchant}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                      {ad.position}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {ad.start} - {ad.end}
                  </TableCell>
                  <TableCell className="text-right font-mono text-gray-600">
                    {ad.impressions.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-medium text-gray-900">
                    ₹{ad.cost.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={ad.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`${ad.status === 'active' ? 'text-red-600 hover:text-red-700 hover:bg-red-50' : 'text-green-600 hover:text-green-700 hover:bg-green-50'}`}
                      onClick={() => toggleStatus(ad.id)}
                    >
                      {ad.status === 'active' ? (
                        <>
                          <PauseCircle className="w-4 h-4 mr-1" /> Stop
                        </>
                      ) : (
                        <>
                          <PlayCircle className="w-4 h-4 mr-1" /> Resume
                        </>
                      )}
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

function StatusBadge({ status }: { status: string }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200 animate-pulse">
        <span className="w-1.5 h-1.5 rounded-full bg-green-600"></span>
        Live
      </span>
    );
  }
  if (status === 'paused') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 border border-yellow-200">
        Paused
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
      Completed
    </span>
  );
}