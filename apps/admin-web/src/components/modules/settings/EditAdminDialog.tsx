import { useState, useEffect } from 'react';
import { X, User, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';

interface EditAdminDialogProps {
    isOpen: boolean;
    onClose: () => void;
    admin: {
        id: string;
        name: string | null;
        email: string;
    } | null;
}

export function EditAdminDialog({ isOpen, onClose, admin }: EditAdminDialogProps) {
    const [name, setName] = useState(admin?.name || '');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Update name when admin changes
    useEffect(() => {
        if (admin) {
            setName(admin.name || '');
        }
    }, [admin]);

    const handleClose = () => {
        setError(null);
        setSuccess(false);
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!admin) return;

        setError(null);
        setIsSubmitting(true);

        const { error: updateError } = await supabase
            .from('User')
            .update({
                name,
                updatedAt: new Date().toISOString()
            })
            .eq('id', admin.id);

        if (updateError) {
            setError(updateError.message);
        } else {
            setSuccess(true);
            setTimeout(() => {
                handleClose();
            }, 1500);
        }

        setIsSubmitting(false);
    };

    if (!isOpen || !admin) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">Edit Admin</h2>
                    <button onClick={handleClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="p-6">
                    {success ? (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                                <CheckCircle className="w-8 h-8 text-green-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Updated!</h3>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                                    <p className="text-sm text-red-700">{error}</p>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                                <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                                    {admin.email}
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="John Doe"
                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#B52725] focus:border-[#B52725] outline-none"
                                        disabled={isSubmitting}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full mt-4 bg-[#121212] text-white py-2.5 rounded-lg hover:bg-[#2d2d2d] transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    'Save Changes'
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
