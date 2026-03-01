import { useState } from 'react';
import { X, Loader2, AlertTriangle, AlertCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import { useAuth } from '../../../context/AuthContext';

interface DeleteAdminDialogProps {
    isOpen: boolean;
    onClose: () => void;
    admin: {
        id: string;
        name: string | null;
        email: string;
    } | null;
}

export function DeleteAdminDialog({ isOpen, onClose, admin }: DeleteAdminDialogProps) {
    const { user } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleClose = () => {
        setError(null);
        onClose();
    };

    const handleDelete = async () => {
        if (!admin) return;

        // Prevent self-deletion
        if (admin.id === user?.id) {
            setError("You cannot delete your own account");
            return;
        }

        setError(null);
        setIsSubmitting(true);

        // Delete from User table only (Supabase Auth user remains but won't be able to login)
        const { error: deleteError } = await supabase
            .from('User')
            .delete()
            .eq('id', admin.id);

        if (deleteError) {
            setError(deleteError.message);
            setIsSubmitting(false);
        } else {
            handleClose();
        }
    };

    if (!isOpen || !admin) return null;

    const isSelf = admin.id === user?.id;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">Delete Admin</h2>
                    <button onClick={handleClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="p-6">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                            <p className="text-sm text-red-700">{error}</p>
                        </div>
                    )}

                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                            <AlertTriangle className="w-6 h-6 text-red-600" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900 mb-1">
                                Are you sure you want to delete this admin?
                            </h3>
                            <p className="text-sm text-gray-600 mb-2">
                                <strong>{admin.name || admin.email}</strong> will no longer be able to access the admin dashboard.
                            </p>
                            {isSelf && (
                                <p className="text-sm text-red-600 font-medium">
                                    ⚠️ You cannot delete your own account.
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-3 mt-6">
                        <button
                            onClick={handleClose}
                            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleDelete}
                            disabled={isSubmitting || isSelf}
                            className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                'Delete Admin'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
