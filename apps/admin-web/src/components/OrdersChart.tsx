import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const data = [
  { hour: '12 AM', today: 5, yesterday: 8 },
  { hour: '1 AM', today: 3, yesterday: 4 },
  { hour: '2 AM', today: 2, yesterday: 3 },
  { hour: '3 AM', today: 1, yesterday: 2 },
  { hour: '4 AM', today: 2, yesterday: 1 },
  { hour: '5 AM', today: 4, yesterday: 3 },
  { hour: '6 AM', today: 8, yesterday: 6 },
  { hour: '7 AM', today: 12, yesterday: 10 },
  { hour: '8 AM', today: 18, yesterday: 15 },
  { hour: '9 AM', today: 25, yesterday: 22 },
  { hour: '10 AM', today: 32, yesterday: 28 },
  { hour: '11 AM', today: 38, yesterday: 35 },
  { hour: '12 PM', today: 42, yesterday: 40 },
];

export function OrdersChart() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-gray-900">Hourly Orders</h2>
        <p className="text-sm text-gray-600">Today vs Yesterday</p>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="hour" 
            tick={{ fontSize: 10 }}
            stroke="#9ca3af"
          />
          <YAxis 
            tick={{ fontSize: 10 }}
            stroke="#9ca3af"
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '12px'
            }}
          />
          <Legend 
            wrapperStyle={{ fontSize: '12px' }}
          />
          <Line 
            type="monotone" 
            dataKey="today" 
            stroke="#3b82f6" 
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            name="Today"
          />
          <Line 
            type="monotone" 
            dataKey="yesterday" 
            stroke="#9ca3af" 
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ r: 3 }}
            name="Yesterday"
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Total (Today)</span>
          <span className="font-bold text-gray-900">42 orders</span>
        </div>
        <div className="flex items-center justify-between text-sm mt-2">
          <span className="text-gray-600">vs Yesterday</span>
          <span className="font-medium text-green-600">+5.0%</span>
        </div>
      </div>
    </div>
  );
}
