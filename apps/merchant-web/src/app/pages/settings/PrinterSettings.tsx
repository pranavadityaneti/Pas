import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Printer, RefreshCw, Check } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import clsx from 'clsx';

export default function PrinterSettings() {
  const navigate = useNavigate();
  const [isScanning, setIsScanning] = useState(false);
  const [connectedPrinter, setConnectedPrinter] = useState<string | null>(null);

  const handleScan = () => {
    setIsScanning(true);
    setTimeout(() => {
        setIsScanning(false);
        toast.info('No new printers found nearby');
    }, 2000);
  };

  const toggleConnect = (printerName: string) => {
    if (connectedPrinter === printerName) {
        setConnectedPrinter(null);
        toast.info(`Disconnected from ${printerName}`);
    } else {
        setConnectedPrinter(printerName);
        toast.success(`Connected to ${printerName}`);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-white text-black pb-24">
      <div className="sticky top-0 bg-white z-10 px-4 py-4 shadow-sm border-b border-gray-100 flex items-center gap-3">
        <button 
          onClick={() => navigate(-1)} 
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
        >
            <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">Printer Settings</h1>
      </div>

      <div className="p-5 flex-1">
        <div className="text-center mb-8 pt-4">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
                <Printer size={40} className="text-gray-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Thermal Printer Setup</h2>
            <p className="text-sm text-gray-500 max-w-xs mx-auto mt-1">Connect a Bluetooth thermal printer to automatically print KOTs and receipts.</p>
        </div>

        <div className="space-y-3 mb-8">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide ml-1">Available Devices</h3>
            
            {['TSC Alpha-3R', 'Epson TM-P20'].map((printer) => (
                <button
                    key={printer}
                    onClick={() => toggleConnect(printer)}
                    className={clsx(
                        "w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all",
                        connectedPrinter === printer 
                            ? "bg-green-50 border-green-500" 
                            : "bg-white border-gray-100 hover:border-gray-200"
                    )}
                >
                    <div className="flex items-center gap-3">
                        <Printer size={20} className={connectedPrinter === printer ? "text-green-600" : "text-gray-400"} />
                        <span className={clsx("font-bold", connectedPrinter === printer ? "text-green-700" : "text-gray-700")}>
                            {printer}
                        </span>
                    </div>
                    {connectedPrinter === printer && (
                        <div className="bg-green-500 text-white p-1 rounded-full">
                            <Check size={14} strokeWidth={3} />
                        </div>
                    )}
                </button>
            ))}
        </div>

        <button 
            onClick={handleScan}
            disabled={isScanning}
            className="w-full bg-gray-100 text-gray-900 h-14 rounded-xl font-bold text-sm hover:bg-gray-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
            <RefreshCw size={18} className={clsx(isScanning && "animate-spin")} />
            {isScanning ? 'Scanning for devices...' : 'Scan for Printers'}
        </button>
      </div>
    </div>
  );
}