import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { 
  BarChart3, 
  Map, 
  TrendingUp, 
  Download,
  Users,
  ShoppingBag
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';

export function AnalyticsDashboard() {
  return (
    <div className="h-full flex flex-col space-y-6 overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Business Intelligence</h2>
          <p className="text-sm text-gray-500">Deep dive into platform performance metrics.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            Last 30 Days
          </Button>
          <Button className="bg-gray-900 text-white gap-2">
            <Download className="w-4 h-4" />
            Download Investor Deck
          </Button>
        </div>
      </div>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Retention Chart Placeholder */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-medium">User Retention (Cohort)</CardTitle>
            <Users className="w-4 h-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="h-[200px] flex items-end justify-between gap-2 px-2">
              {[65, 59, 80, 81, 56, 55, 40, 70, 75, 60, 50, 45].map((h, i) => (
                <div key={i} className="w-full bg-blue-100 rounded-t-sm relative group">
                  <div 
                    className="absolute bottom-0 left-0 right-0 bg-blue-600 rounded-t-sm transition-all duration-500" 
                    style={{ height: `${h}%` }} 
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>Jan 1</span>
              <span>Jan 15</span>
              <span>Jan 30</span>
            </div>
          </CardContent>
        </Card>

        {/* Heatmap Placeholder */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-medium">Demand Heatmap</CardTitle>
            <Map className="w-4 h-4 text-gray-500" />
          </CardHeader>
          <CardContent className="relative h-[232px] bg-gray-100 rounded-lg overflow-hidden m-4 mt-0">
             {/* Simple visual representation of a heatmap */}
             <div className="absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_30%_30%,rgba(255,0,0,0.4),transparent_40%),radial-gradient(circle_at_70%_60%,rgba(255,0,0,0.5),transparent_40%)]"></div>
             <div className="absolute inset-0 flex items-center justify-center text-gray-400 font-medium">
               Map Visualization Loaded
             </div>
          </CardContent>
        </Card>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-2 gap-6 pb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Performing Merchants</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Merchant</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Growth</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Ratnadeep Supermarket</TableCell>
                  <TableCell className="text-right">₹4.5L</TableCell>
                  <TableCell className="text-right text-green-600">+12%</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Vijetha Supermarkets</TableCell>
                  <TableCell className="text-right">₹3.2L</TableCell>
                  <TableCell className="text-right text-green-600">+8%</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Organic World</TableCell>
                  <TableCell className="text-right">₹1.8L</TableCell>
                  <TableCell className="text-right text-red-600">-2%</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Fresh Mart</TableCell>
                  <TableCell className="text-right">₹95k</TableCell>
                  <TableCell className="text-right text-green-600">+15%</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Selling Products</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Fresh Milk (500ml)</TableCell>
                  <TableCell className="text-right">1,204</TableCell>
                  <TableCell className="text-right">₹32k</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Whole Wheat Bread</TableCell>
                  <TableCell className="text-right">850</TableCell>
                  <TableCell className="text-right">₹42k</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Tomato (1kg)</TableCell>
                  <TableCell className="text-right">720</TableCell>
                  <TableCell className="text-right">₹18k</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Onion (1kg)</TableCell>
                  <TableCell className="text-right">650</TableCell>
                  <TableCell className="text-right">₹16k</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}