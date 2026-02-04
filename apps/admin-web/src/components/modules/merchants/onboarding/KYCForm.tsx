import { useRef } from 'react';
import { Label } from "../../../ui/label";
import { Input } from "../../../ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../../../ui/select";
import { Upload, FileText, CreditCard, Building2, BadgeCheck, X } from 'lucide-react';

export interface KYCData {
    panNumber: string;
    aadharNumber: string;
    bankAccount: string;
    ifsc: string;
    turnoverRange: string;
    panDocument?: File | null;
    aadharFront?: File | null;
    aadharBack?: File | null;
    gstDocument?: File | null;
    gstNumber?: string;
    storePhotos?: File[];
}

interface KYCFormProps {
    data: KYCData;
    onChange: (data: KYCData) => void;
}

interface FileUploadProps {
    label: string;
    accept?: string;
    file?: File | null;
    onFileChange: (file: File | null) => void;
}

function FileUpload({ label, accept = "image/*,.pdf", file, onFileChange }: FileUploadProps) {
    const inputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="relative">
            <input
                ref={inputRef}
                type="file"
                accept={accept}
                className="sr-only absolute w-0 h-0 opacity-0 pointer-events-none"
                style={{ position: 'absolute', visibility: 'hidden', width: 0, height: 0 }}
                onChange={(e) => onFileChange(e.target.files?.[0] || null)}
            />

            {file ? (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <FileText className="w-4 h-4 text-green-600 shrink-0" />
                    <span className="text-sm text-gray-700 truncate flex-1">{file.name}</span>
                    <button
                        type="button"
                        onClick={() => onFileChange(null)}
                        className="p-1 hover:bg-green-100 rounded"
                    >
                        <X className="w-4 h-4 text-gray-500" />
                    </button>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg text-center
                               hover:border-blue-400 hover:bg-blue-50 transition-all duration-200 group"
                >
                    <Upload className="w-6 h-6 mx-auto text-gray-400 group-hover:text-blue-500 mb-2" />
                    <p className="text-sm font-medium text-gray-600">{label}</p>
                    <p className="text-xs text-gray-400 mt-1">Click to upload</p>
                </button>
            )}
        </div>
    );
}

export function KYCForm({ data, onChange }: KYCFormProps) {
    const handleChange = (field: keyof KYCData, value: string | File | null) => {
        onChange({ ...data, [field]: value });
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-300">

            {/* Identity Verification Section */}
            <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                <div className="flex items-center gap-2 mb-6">
                    <BadgeCheck className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold text-gray-900">Identity Verification</h3>
                </div>

                {/* Single column layout */}
                <div className="space-y-5">
                    <div className="space-y-2">
                        <Label className="text-gray-700 text-sm font-medium">
                            PAN Number <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            value={data.panNumber}
                            onChange={(e) => handleChange('panNumber', e.target.value.toUpperCase())}
                            placeholder="ABCDE1234F"
                            className="uppercase bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500 h-11"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label className="text-gray-700 text-sm font-medium">
                            Aadhar Number <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            value={data.aadharNumber}
                            onChange={(e) => handleChange('aadharNumber', e.target.value)}
                            placeholder="1234 5678 9012"
                            className="bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500 h-11"
                        />
                    </div>
                </div>

                {/* Document Uploads */}
                <div className="mt-6 pt-5 border-t border-gray-200">
                    <Label className="text-gray-600 text-sm font-medium mb-4 block">Upload Documents</Label>
                    <div className="space-y-4">
                        <FileUpload
                            label="PAN Card"
                            file={data.panDocument}
                            onFileChange={(f) => handleChange('panDocument', f)}
                        />
                        <FileUpload
                            label="Aadhar Front"
                            file={data.aadharFront}
                            onFileChange={(f) => handleChange('aadharFront', f)}
                        />
                        <FileUpload
                            label="Aadhar Back"
                            file={data.aadharBack}
                            onFileChange={(f) => handleChange('aadharBack', f)}
                        />
                    </div>
                </div>
            </div>

            {/* Banking Details Section */}
            <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                <div className="flex items-center gap-2 mb-6">
                    <Building2 className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold text-gray-900">Banking Details</h3>
                </div>

                <div className="space-y-5">
                    <div className="space-y-2">
                        <Label className="text-gray-700 text-sm font-medium">
                            Bank Account Number <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            value={data.bankAccount}
                            onChange={(e) => handleChange('bankAccount', e.target.value)}
                            placeholder="Enter your account number"
                            className="bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500 h-11"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label className="text-gray-700 text-sm font-medium">
                            IFSC Code <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            value={data.ifsc}
                            onChange={(e) => handleChange('ifsc', e.target.value.toUpperCase())}
                            placeholder="SBIN0001234"
                            className="uppercase bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500 h-11"
                        />
                    </div>
                </div>
            </div>

            {/* Business Information Section */}
            <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                <div className="flex items-center gap-2 mb-6">
                    <CreditCard className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold text-gray-900">Business Information</h3>
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label className="text-gray-700 text-sm font-medium">Annual Turnover Range</Label>
                        <Select
                            value={data.turnoverRange}
                            onValueChange={(val) => handleChange('turnoverRange', val)}
                        >
                            <SelectTrigger className="bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500 h-11">
                                <SelectValue placeholder="Select Turnover Range" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="<20L">Less than ₹20 Lakhs</SelectItem>
                                <SelectItem value="20L-40L">₹20 Lakhs - ₹40 Lakhs</SelectItem>
                                <SelectItem value="40L-1Cr">₹40 Lakhs - ₹1 Crore</SelectItem>
                                <SelectItem value=">1Cr">More than ₹1 Crore</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {data.turnoverRange !== '<20L' && (
                        <div className="space-y-4 pt-4 border-t border-gray-200 animate-in fade-in duration-300">
                            <div className="space-y-2">
                                <Label className="text-gray-700 text-sm font-medium">GST Number <span className="text-red-500">*</span></Label>
                                <Input
                                    value={data.gstNumber}
                                    onChange={(e) => handleChange('gstNumber', e.target.value.toUpperCase())}
                                    placeholder="22AAAAA0000A1Z5"
                                    className="uppercase bg-white border-gray-300 h-11"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-gray-700 text-sm font-medium">GST Certificate <span className="text-red-500">*</span></Label>
                                <FileUpload
                                    label="GST Certificate"
                                    file={data.gstDocument}
                                    onFileChange={(f) => handleChange('gstDocument', f)}
                                />
                            </div>
                        </div>
                    )}

                    <div className="space-y-2 pt-4 border-t border-gray-200">
                        <Label className="text-gray-700 text-sm font-medium">Store Photos (Min 2) <span className="text-red-500">*</span></Label>
                        <div className="grid grid-cols-2 gap-3 mb-2">
                            {(data.storePhotos || []).map((p, i) => (
                                <div key={i} className="relative group">
                                    <div className="h-20 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden">
                                        <img src={URL.createObjectURL(p)} alt="Store" className="w-full h-full object-cover" />
                                    </div>
                                    <button
                                        onClick={() => {
                                            const newPhotos = [...(data.storePhotos || [])];
                                            newPhotos.splice(i, 1);
                                            handleChange('storePhotos', newPhotos as any);
                                        }}
                                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <FileUpload
                            label="Add Store Photo"
                            accept="image/*"
                            onFileChange={(f) => {
                                if (f) {
                                    const newPhotos = [...(data.storePhotos || []), f];
                                    handleChange('storePhotos', newPhotos as any);
                                }
                            }}
                        />
                        <p className="text-[10px] text-gray-400">Please upload front and inside views.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
