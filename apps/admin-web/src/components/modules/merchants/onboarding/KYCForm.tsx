import { Label } from "../../../ui/label";
import { Input } from "../../../ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../../../ui/select";

export interface KYCData {
    panNumber: string;
    aadharNumber: string;
    bankAccount: string;
    ifsc: string;
    turnoverRange: string;
}

interface KYCFormProps {
    data: KYCData;
    onChange: (data: KYCData) => void;
}

export function KYCForm({ data, onChange }: KYCFormProps) {
    const handleChange = (field: keyof KYCData, value: string) => {
        onChange({ ...data, [field]: value });
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-300">
            <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label>PAN Number</Label>
                    <Input
                        value={data.panNumber}
                        onChange={(e) => handleChange('panNumber', e.target.value)}
                        placeholder="ABCDE1234F"
                        className="uppercase"
                    />
                </div>
                <div className="space-y-2">
                    <Label>Aadhar Number</Label>
                    <Input
                        value={data.aadharNumber}
                        onChange={(e) => handleChange('aadharNumber', e.target.value)}
                        placeholder="1234 5678 9012"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label>Bank Account Number</Label>
                    <Input
                        value={data.bankAccount}
                        onChange={(e) => handleChange('bankAccount', e.target.value)}
                        placeholder="Account Number"
                        type="password"
                    />
                </div>
                <div className="space-y-2">
                    <Label>IFSC Code</Label>
                    <Input
                        value={data.ifsc}
                        onChange={(e) => handleChange('ifsc', e.target.value)}
                        placeholder="SBIN0001234"
                        className="uppercase"
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label>Annual Turnover Range</Label>
                <Select
                    value={data.turnoverRange}
                    onValueChange={(val) => handleChange('turnoverRange', val)}
                >
                    <SelectTrigger>
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
    );
}
