import { Trophy, ArrowUpRight } from 'lucide-react';

interface TopStoresListProps {
  stores: any[];
}

export function TopStoresList({ stores }: TopStoresListProps) {
  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          Top Performing Stores
        </h3>
        <button className="text-sm text-primary hover:underline flex items-center">
          View All <ArrowUpRight className="w-4 h-4 ml-1" />
        </button>
      </div>

      <div className="space-y-4">
        {stores.length > 0 ? (
          stores.map((store, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                  {index + 1}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{store.name}</p>
                  <p className="text-xs text-gray-500">{store.orders} Orders</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-900 flex items-center gap-1">
                  <span className="text-xs text-gray-500">₹</span>
                  {store.gmv.toLocaleString()}
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-gray-500 text-sm">No store data currently available.</div>
        )}
      </div>
    </div>
  );
}
