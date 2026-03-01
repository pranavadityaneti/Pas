import React from 'react';
import { Clock, Printer, Users, ChevronRight, Store, LogOut } from 'lucide-react';
import { Button } from '@/app/components/ui/button';

export default function SettingsScreen() {
  const settingsGroups = [
    {
      title: "Store Operations",
      items: [
        { icon: Clock, label: "Store Timings", desc: "Set opening & closing hours" },
        { icon: Printer, label: "Printer Connection", desc: "Connect thermal printer" },
        { icon: Users, label: "Staff Management", desc: "Manage cashier access" },
      ]
    },
    {
      title: "Account",
      items: [
        { icon: Store, label: "Branch Details", desc: "Address & Contact Info" },
      ]
    }
  ];

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white border-b px-6 py-4 sticky top-0 z-10">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {settingsGroups.map((group, idx) => (
          <div key={idx}>
            <h2 className="text-sm font-semibold text-gray-500 mb-2 px-2 uppercase tracking-wider">{group.title}</h2>
            <div className="bg-white rounded-lg border shadow-sm divide-y divide-gray-100 overflow-hidden">
              {group.items.map((item, i) => (
                <button 
                  key={i} 
                  className="w-full flex items-center p-4 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-md mr-4">
                    <item.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{item.label}</p>
                    <p className="text-xs text-gray-500">{item.desc}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300" />
                </button>
              ))}
            </div>
          </div>
        ))}

        <div className="pt-4">
          <Button variant="outline" className="w-full text-red-600 border-red-100 hover:bg-red-50 hover:text-red-700 h-12">
            <LogOut className="w-4 h-4 mr-2" />
            Log Out
          </Button>
          <p className="text-center text-xs text-gray-400 mt-4">
            Version 2.0.1 • Build 4829
          </p>
        </div>
      </div>
    </div>
  );
}
