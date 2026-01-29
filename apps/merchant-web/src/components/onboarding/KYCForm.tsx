import { useRef } from 'react';
import { Label } from '@/app/components/ui/label';
import { Input } from '@/app/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/app/components/ui/select';
import { Upload, FileText, CreditCard, Building2, BadgeCheck, X, Award } from 'lucide-react';

export interface KYCData {
    panNumber: string;
    aadharNumber: string;
    bankAccount: string;
    ifsc: string;
    turnoverRange: string;
    msmeNumber: string;
    panDocument?: File | null;
    aadharFront?: File | null;
    aadharBack?: File | null;
    msmeCertificate?: File | null;
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
                               hover:border-indigo-400 hover:bg-indigo-50 transition-all duration-200 group"
                >
                    <Upload className="w-6 h-6 mx-auto text-gray-400 group-hover:text-indigo-500 mb-2" />
                    <p className="text-sm font-medium text-gray-600">{label}</p>
                    <p className="text-xs text-gray-400 mt-1">Tap to upload</p>
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
        <div className="space-y-6">

            {/* Identity Verification Section */}
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                <div className="flex items-center gap-2 mb-5">
                    <BadgeCheck className="w-5 h-5 text-indigo-600" />
                    <h3 className="font-semibold text-gray-900">Identity Verification</h3>
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label className="text-gray-700 text-sm font-medium">
                            PAN Number <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            value={data.panNumber}
                            onChange={(e) => handleChange('panNumber', e.target.value.toUpperCase())}
                            placeholder="ABCDE1234F"
                            className="uppercase bg-white"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label className="text-gray-700 text-sm font-medium">
                            Aadhaar Number <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            value={data.aadharNumber}
                            onChange={(e) => handleChange('aadharNumber', e.target.value)}
                            placeholder="1234 5678 9012"
                            className="bg-white"
                        />
                    </div>
                </div>

                {/* Document Uploads */}
                <div className="mt-5 pt-4 border-t border-gray-200">
                    <Label className="text-gray-600 text-sm font-medium mb-3 block">Upload Documents</Label>
                    <div className="space-y-3">
                        <FileUpload
                            label="PAN Card"
                            file={data.panDocument}
                            onFileChange={(f) => handleChange('panDocument', f)}
                        />
                        <FileUpload
                            label="Aadhaar Front"
                            file={data.aadharFront}
                            onFileChange={(f) => handleChange('aadharFront', f)}
                        />
                        <FileUpload
                            label="Aadhaar Back"
                            file={data.aadharBack}
                            onFileChange={(f) => handleChange('aadharBack', f)}
                        />
                    </div>
                </div>
            </div>

            {/* MSME Section */}
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                <div className="flex items-center gap-2 mb-5">
                    <Award className="w-5 h-5 text-indigo-600" />
                    <h3 className="font-semibold text-gray-900">MSME Registration</h3>
                    <span className="text-xs text-gray-400">(Optional)</span>
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label className="text-gray-700 text-sm font-medium">MSME/Udyam Number</Label>
                        <Input
                            value={data.msmeNumber}
                            onChange={(e) => handleChange('msmeNumber', e.target.value.toUpperCase())}
                            placeholder="UDYAM-XX-00-0000000"
                            className="uppercase bg-white"
                        />
                    </div>
                    <FileUpload
                        label="MSME Certificate"
                        file={data.msmeCertificate}
                        onFileChange={(f) => handleChange('msmeCertificate', f)}
                    />
                </div>
            </div>

            {/* Banking Details Section */}
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                <div className="flex items-center gap-2 mb-5">
                    <Building2 className="w-5 h-5 text-indigo-600" />
                    <h3 className="font-semibold text-gray-900">Banking Details</h3>
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label className="text-gray-700 text-sm font-medium">
                            Bank Account Number <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            value={data.bankAccount}
                            onChange={(e) => handleChange('bankAccount', e.target.value)}
                            placeholder="Enter your account number"
                            className="bg-white"
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
                            className="uppercase bg-white"
                        />
                    </div>
                </div>
            </div>

            {/* Business Information Section */}
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                <div className="flex items-center gap-2 mb-5">
                    <CreditCard className="w-5 h-5 text-indigo-600" />
                    <h3 className="font-semibold text-gray-900">Business Information</h3>
                </div>

                <div className="space-y-2">
                    <Label className="text-gray-700 text-sm font-medium">Annual Turnover Range</Label>
                    <Select
                        value={data.turnoverRange}
                        onValueChange={(val) => handleChange('turnoverRange', val)}
                    >
                        <SelectTrigger className="bg-white">
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
