import { useState } from 'react';
import { Download, FileSpreadsheet, FileText, FileType } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Label } from '../../ui/label';
import { Checkbox } from '../../ui/checkbox';
import { RadioGroup, RadioGroupItem } from '../../ui/radio-group';
import { DateRangePicker } from '../../ui/date-range-picker';
import { toast } from 'sonner';
import { useMerchants } from '../../../hooks/useMerchants';

interface ExportMerchantsDialogProps {
    trigger?: React.ReactNode;
}

const DATE_PRESETS = [
    { id: 'all', label: 'All Time' },
    { id: '30d', label: 'Last 30 Days' },
    { id: '7d', label: 'Last 7 Days' },
    { id: 'custom', label: 'Custom Range' },
];

const EXPORT_FIELDS = [
    { id: 'store_name', label: 'Store Name', default: true },
    { id: 'branch_name', label: 'Branch', default: true },
    { id: 'owner_name', label: 'Owner Name', default: true },
    { id: 'phone', label: 'Phone', default: true },
    { id: 'email', label: 'Email', default: true },
    { id: 'city', label: 'City', default: true },
    { id: 'address', label: 'Address', default: false },
    { id: 'status', label: 'Status', default: true },
    { id: 'rating', label: 'Rating', default: true },
    { id: 'kyc_status', label: 'KYC Status', default: true },
    { id: 'created_at', label: 'Onboarding Date', default: false },
];

export function ExportMerchantsDialog({ trigger }: ExportMerchantsDialogProps) {
    const { exportMerchants } = useMerchants();
    const [open, setOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [format, setFormat] = useState<'csv' | 'excel' | 'pdf'>('csv');
    const [datePreset, setDatePreset] = useState('all');
    const [customRange, setCustomRange] = useState<DateRange | undefined>();
    const [selectedFields, setSelectedFields] = useState<string[]>(
        EXPORT_FIELDS.filter(f => f.default).map(f => f.id)
    );

    const getDateRange = (): { from: Date; to: Date } | undefined => {
        const now = new Date();
        switch (datePreset) {
            case '7d':
                return { from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), to: now };
            case '30d':
                return { from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), to: now };
            case 'custom':
                if (customRange?.from && customRange?.to) {
                    return { from: customRange.from, to: customRange.to };
                }
                return undefined;
            default:
                return undefined;
        }
    };

    const handleExport = async () => {
        if (selectedFields.length === 0) {
            toast.error('Please select at least one field to export');
            return;
        }

        setIsExporting(true);
        try {
            const csvContent = await exportMerchants({
                format,
                dateRange: getDateRange(),
                fields: selectedFields
            });

            // Download file
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `merchants_export_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            toast.success('Export completed', {
                description: `Downloaded ${format.toUpperCase()} file`
            });
            setOpen(false);
        } catch (error) {
            console.error('Export failed:', error);
        } finally {
            setIsExporting(false);
        }
    };

    const toggleField = (fieldId: string) => {
        setSelectedFields(prev =>
            prev.includes(fieldId)
                ? prev.filter(f => f !== fieldId)
                : [...prev, fieldId]
        );
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" className="gap-2">
                        <Download className="w-4 h-4" />
                        Export
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[420px]">
                <DialogHeader>
                    <DialogTitle>Export Merchants</DialogTitle>
                    <DialogDescription>
                        Download merchant data in your preferred format
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-4">
                    {/* Format Selection */}
                    <div className="space-y-2">
                        <Label className="text-sm font-medium">Format</Label>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant={format === 'csv' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setFormat('csv')}
                                className="flex-1 gap-2"
                            >
                                <FileText className="w-4 h-4" />
                                CSV
                            </Button>
                            <Button
                                type="button"
                                variant={format === 'excel' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setFormat('excel')}
                                className="flex-1 gap-2"
                            >
                                <FileSpreadsheet className="w-4 h-4" />
                                Excel
                            </Button>
                            <Button
                                type="button"
                                variant={format === 'pdf' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setFormat('pdf')}
                                className="flex-1 gap-2"
                            >
                                <FileType className="w-4 h-4" />
                                PDF
                            </Button>
                        </div>
                    </div>

                    {/* Date Range */}
                    <div className="space-y-2">
                        <Label className="text-sm font-medium">Date Range</Label>
                        <RadioGroup value={datePreset} onValueChange={setDatePreset} className="grid grid-cols-2 gap-2">
                            {DATE_PRESETS.map(preset => (
                                <div key={preset.id} className="flex items-center space-x-2">
                                    <RadioGroupItem value={preset.id} id={preset.id} />
                                    <Label htmlFor={preset.id} className="text-sm font-normal cursor-pointer">
                                        {preset.label}
                                    </Label>
                                </div>
                            ))}
                        </RadioGroup>
                        {datePreset === 'custom' && (
                            <div className="mt-2">
                                <DateRangePicker
                                    value={customRange}
                                    onChange={setCustomRange}
                                />
                            </div>
                        )}
                    </div>

                    {/* Field Selection */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <Label className="text-sm font-medium">Fields to Export</Label>
                            <button
                                type="button"
                                className="text-xs text-blue-600 hover:underline"
                                onClick={() => setSelectedFields(EXPORT_FIELDS.map(f => f.id))}
                            >
                                Select All
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 border rounded-md bg-gray-50">
                            {EXPORT_FIELDS.map(field => (
                                <div key={field.id} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={field.id}
                                        checked={selectedFields.includes(field.id)}
                                        onCheckedChange={() => toggleField(field.id)}
                                    />
                                    <Label htmlFor={field.id} className="text-xs font-normal cursor-pointer">
                                        {field.label}
                                    </Label>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleExport} disabled={isExporting} className="gap-2">
                        <Download className="w-4 h-4" />
                        {isExporting ? 'Exporting...' : 'Export'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
