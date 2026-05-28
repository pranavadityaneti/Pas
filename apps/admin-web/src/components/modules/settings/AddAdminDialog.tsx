import { useState } from 'react';
import { X, Phone, User, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import api from '../../../lib/api';

interface AddAdminDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export function AddAdminDialog({ isOpen, onClose }: AddAdminDialogProps) {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState(''); // 10 digits, no country code
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const resetForm = () => {
        setName('');
        setPhone('');
        setError(null);
        setSuccess(false);
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const digits = phone.replace(/\D/g, '');
        if (digits.length !== 10) {
            setError('Enter a valid 10-digit mobile number');
            return;
        }

        setIsSubmitting(true);
        try {
            await api.post('/admin/allowlist', { phone: `91${digits}`, name: name.trim() || undefined });
            setSuccess(true);
            setTimeout(() => handleClose(), 2000);
        } catch (err: any) {
            setError(err?.response?.data?.error || err?.message || 'Failed to add admin');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

            {/* Dialog */}
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">Add New Admin</h2>
                    <button onClick={handleClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {success ? (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                                <CheckCircle className="w-8 h-8 text-green-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Admin Authorized!</h3>
                            <p className="text-sm text-gray-600">
                                They can now log in with WhatsApp OTP using this number.
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                                    <p className="text-sm text-red-700">{error}</p>
                                </div>
                            )}

                            {/* Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Jane Doe"
                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                                        disabled={isSubmitting}
                                    />
                                </div>
                            </div>

                            {/* Phone */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">WhatsApp Number</label>
                                <div className="relative flex items-center">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <span className="absolute left-9 text-gray-500 text-sm select-none">+91</span>
                                    <input
                                        type="tel"
                                        inputMode="numeric"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                        placeholder="9876543210"
                                        className="w-full pl-20 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none tracking-wide"
                                        required
                                        disabled={isSubmitting}
                                    />
                                </div>
                                <p className="text-xs text-gray-400 mt-1.5">
                                    They'll log in via WhatsApp OTP — no password needed.
                                </p>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full mt-6 bg-[#121212] text-white py-2.5 rounded-lg hover:bg-[#2d2d2d] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Authorizing...
                                    </>
                                ) : (
                                    'Authorize Admin'
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
