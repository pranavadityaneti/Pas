import React from 'react';
import { Label } from "../../../ui/label";
import { Input } from "../../../ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../../../ui/select";
import { Upload, FileText, CreditCard, Building2, BadgeCheck } from 'lucide-react';

export interface KYCData {
    panNumber: string;
    aadharNumber: string;
    bankAccount: string;
    ifsc: string;
    turnoverRange: string;
    panDocument?: File | null;
    aadharFront?: File | null;
    aadharBack?: File | null;
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
    const inputRef = React.useRef<HTMLInputElement>(null);

    return (
        <div
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center cursor-pointer
                       hover:border-blue-400 hover:bg-blue-50/50 transition-all duration-200 group"
        >
            <input
                ref={inputRef}
                type="file"
                accept={accept}
                className="hidden"
                onChange={(e) => onFileChange(e.target.files?.[0] || null)}
            />
            {file ? (
                <div className="flex items-center justify-center gap-2">
                    <FileText className="w-5 h-5 text-green-600" />
                    <span className="text-sm text-gray-700 truncate max-w-[120px]">{file.name}</span>
                </div>
            ) : (
                <>
                    <Upload className="w-6 h-6 mx-auto text-gray-400 group-hover:text-blue-500 transition-colors" />
                    <p className="text-xs text-gray-500 mt-1">{label}</p>
                </>
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
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                <div className="flex items-center gap-2 mb-4">
                    <BadgeCheck className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold text-gray-900">Identity Verification</h3>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label className="text-gray-700">PAN Number <span className="text-red-500">*</span></Label>
                        <Input
                            value={data.panNumber}
                            onChange={(e) => handleChange('panNumber', e.target.value.toUpperCase())}
                            placeholder="ABCDE1234F"
                            className="uppercase bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-gray-700">Aadhar Number <span className="text-red-500">*</span></Label>
                        <Input
                            value={data.aadharNumber}
                            onChange={(e) => handleChange('aadharNumber', e.target.value)}
                            placeholder="1234 5678 9012"
                            className="bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                        />
                    </div>
                </div>

                {/* Document Uploads */}
                <div className="mt-4">
                    <Label className="text-gray-600 text-sm mb-2 block">Upload Documents</Label>
                    <div className="grid grid-cols-3 gap-3">
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
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                <div className="flex items-center gap-2 mb-4">
                    <Building2 className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold text-gray-900">Banking Details</h3>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label className="text-gray-700">Bank Account Number <span className="text-red-500">*</span></Label>
                        <Input
                            value={data.bankAccount}
                            onChange={(e) => handleChange('bankAccount', e.target.value)}
                            placeholder="Enter account number"
                            className="bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-gray-700">IFSC Code <span className="text-red-500">*</span></Label>
                        <Input
                            value={data.ifsc}
                            onChange={(e) => handleChange('ifsc', e.target.value.toUpperCase())}
                            placeholder="SBIN0001234"
                            className="uppercase bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                        />
                    </div>
                </div>
            </div>

            {/* Business Information Section */}
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                <div className="flex items-center gap-2 mb-4">
                    <CreditCard className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold text-gray-900">Business Information</h3>
                </div>

                <div className="space-y-2">
                    <Label className="text-gray-700">Annual Turnover Range</Label>
                    <Select
                        value={data.turnoverRange}
                        onValueChange={(val) => handleChange('turnoverRange', val)}
                    >
                        <SelectTrigger className="bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                            <SelectValue placeholder="Select Turnover Range" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="<20L">Less than ₹20 Lakhs</SelectItem>
                            <SelectItem value="20L-1Cr">₹20 Lakhs - ₹1 Crore</SelectItem>
                            <SelectItem value="1Cr-5Cr">₹1 Crore - ₹5 Crores</SelectItem>
                            <SelectItem value=">5Cr">More than ₹5 Crores</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
    );
}
