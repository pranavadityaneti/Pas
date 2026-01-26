import { AddMerchantSheet } from './AddMerchantSheet';

// ... (existing imports)

export function MerchantDirectory() {
  // ... (existing state)

  // ... (existing handlers)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-1">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search by Store Name, Owner, or Phone"
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-500">
            Showing {filteredMerchants.length} merchants
          </div>
          <AddMerchantSheet />
        </div>
      </div>

      <div className="rounded-md border border-gray-200 bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead>Store Name</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Owner Name</TableHead>
              <TableHead>City</TableHead>
              <TableHead className="text-center">Rating</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="w-[150px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMerchants.map((merchant) => (
              <TableRow key={merchant.id} className="group hover:bg-blue-50/50 transition-colors">
                <TableCell className="font-medium text-gray-900">{merchant.name}</TableCell>
                <TableCell className="text-gray-600">{merchant.branch}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-sm text-gray-900">{merchant.owner}</span>
                    <span className="text-xs text-gray-500">{merchant.phone}</span>
                  </div>
                </TableCell>
                <TableCell>{merchant.city}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-none gap-1">
                    {merchant.rating} <Star className="w-3 h-3 fill-yellow-600 text-yellow-600" />
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex justify-center">
                    <Switch checked={merchant.status} onCheckedChange={() => { }} />
                  </div>
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="outline"
                    className="opacity-0 group-hover:opacity-100 transition-opacity bg-white border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
                    onClick={() => handleImpersonate(merchant.name)}
                  >
                    <LogIn className="w-4 h-4 mr-2" />
                    Login as
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
