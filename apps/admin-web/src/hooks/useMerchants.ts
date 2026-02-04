import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'sonner';

export interface Merchant {
    id: string;
    store_name: string;
    branch_name?: string;
    owner_name: string;
    email: string;
    phone: string;
    city: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    has_branches: boolean;
    kyc_status: 'pending' | 'approved' | 'rejected';
    status: 'active' | 'inactive' | 'blacklisted';
    rating?: number;
    commission_rate?: number;
    operating_hours?: string;
    created_at: string;
    updated_at?: string;
    // KYC & Bank Details
    pan_number?: string;
    aadhar_number?: string;
    bank_account_number?: string;
    ifsc_code?: string;
    turnover_range?: string;
    operating_days?: string[];
    // KYC Documents
    pan_doc_url?: string;
    aadhar_front_url?: string;
    aadhar_back_url?: string;
    gst_certificate_url?: string;
    gst_number?: string;
    store_photos?: string[];
    kyc_rejection_reason?: string;
    // Computed/joined fields
    orders_30d?: number;
    revenue_30d?: number;
    is_online?: boolean;
    last_active?: string;
    merchant_branches?: MerchantBranch[];
}

export interface MerchantBranch {
    id: string;
    merchant_id: string;
    branch_name: string;
    manager_name?: string;
    phone?: string;
    email?: string;
    address?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
    is_active?: boolean;
}

export interface MerchantStats {
    total_orders: number;
    orders_30d: number;
    orders_7d: number;
    total_gmv: number;
    gmv_30d: number;
    gmv_7d: number;
    avg_order_value: number;
    current_rating: number;
    rating_30d_avg: number;
    fulfillment_rate: number;
    pending_payout: number;
    top_categories: { name: string; count: number }[];
    daily_orders: { date: string; orders: number; gmv: number }[];
}

// --- SINGLETON STATE ---
let globalMerchants: Merchant[] = [];
let globalLoading = false;
let globalError: string | null = null;
let listeners: Array<() => void> = [];

const notifyListeners = () => {
    listeners.forEach(l => l());
};

export function useMerchants() {
    const [merchants, setMerchants] = useState<Merchant[]>(globalMerchants);
    const [loading, setLoading] = useState(globalLoading);
    const [error, setError] = useState<string | null>(globalError);

    // Subscribe to global state changes
    useEffect(() => {
        const listener = () => {
            setMerchants(globalMerchants);
            setLoading(globalLoading);
            setError(globalError);
        };
        listeners.push(listener);

        // Initial sync
        listener();

        // If no data and not loading, fetch
        if (globalMerchants.length === 0 && !globalLoading) {
            fetchMerchantsGlobal();
        }

        return () => {
            listeners = listeners.filter(l => l !== listener);
        };
    }, []);

    // Global Fetch Function
    const fetchMerchants = useCallback(async () => {
        await fetchMerchantsGlobal();
    }, []);

    const uploadFile = async (file: File, path: string) => {
        const { data, error } = await supabase.storage
            .from('merchant-docs')
            .upload(path, file, { upsert: true });

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
            .from('merchant-docs')
            .getPublicUrl(data.path);

        return publicUrl;
    };

    const createMerchant = async (
        merchantData: Partial<Merchant>,
        files?: {
            pan?: File | null,
            aadharFront?: File | null,
            aadharBack?: File | null,
            gst?: File | null,
            storePhotos?: File[]
        }
    ) => {
        globalLoading = true;
        notifyListeners();
        try {
            // Upload files if present
            let panUrl = '';
            let aadharFrontUrl = '';
            let aadharBackUrl = '';
            let gstUrl = '';

            const timestamp = Date.now();
            const safeName = merchantData.store_name?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'unknown';

            if (files?.pan) {
                panUrl = await uploadFile(files.pan, `${safeName}/pan_${timestamp}.png`);
            }
            if (files?.aadharFront) {
                aadharFrontUrl = await uploadFile(files.aadharFront, `${safeName}/aadhar_front_${timestamp}.png`);
            }
            if (files?.aadharBack) {
                aadharBackUrl = await uploadFile(files.aadharBack, `${safeName}/aadhar_back_${timestamp}.png`);
            }
            if (files?.gst) {
                gstUrl = await uploadFile(files.gst, `${safeName}/gst_${timestamp}.png`);
            }

            const storePhotoUrls = [];
            if (files?.storePhotos) {
                for (let i = 0; i < files.storePhotos.length; i++) {
                    const url = await uploadFile(files.storePhotos[i], `${safeName}/store_${i}_${timestamp}.png`);
                    storePhotoUrls.push(url);
                }
            }

            const { data, error } = await supabase
                .from('merchants')
                .insert([
                    {
                        store_name: merchantData.store_name,
                        branch_name: merchantData.branch_name,
                        owner_name: merchantData.owner_name,
                        email: merchantData.email,
                        phone: merchantData.phone,
                        city: merchantData.city,
                        address: merchantData.address,
                        latitude: merchantData.latitude,
                        longitude: merchantData.longitude,
                        has_branches: merchantData.has_branches || false,
                        kyc_status: 'pending',
                        status: 'active',
                        commission_rate: merchantData.commission_rate || 10,
                        operating_hours: merchantData.operating_hours,
                        operating_days: merchantData.operating_days,
                        pan_number: merchantData.pan_number,
                        aadhar_number: merchantData.aadhar_number,
                        bank_account_number: merchantData.bank_account_number,
                        ifsc_code: merchantData.ifsc_code,
                        turnover_range: merchantData.turnover_range,
                        // Document URLs
                        pan_doc_url: panUrl || null,
                        aadhar_front_url: aadharFrontUrl || null,
                        aadhar_back_url: aadharBackUrl || null,
                        gst_certificate_url: gstUrl || null,
                        gst_number: merchantData.gst_number,
                        store_photos: storePhotoUrls.length > 0 ? storePhotoUrls : merchantData.store_photos || []
                    }
                ])
                .select()
                .single();

            if (error) throw error;

            await fetchMerchantsGlobal();
            toast.success('Merchant application submitted successfully');
            return data;
        } catch (err: any) {
            console.error('Error creating merchant:', err);
            toast.error('Failed to create merchant', { description: err.message });
            throw err;
        } finally {
            globalLoading = false;
            notifyListeners();
        }
    };

    const updateMerchant = async (id: string, updates: Partial<Merchant>) => {
        globalLoading = true;
        notifyListeners();
        try {
            const { data, error } = await supabase
                .from('merchants')
                .update({
                    ...updates,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            await fetchMerchantsGlobal();
            toast.success('Merchant updated successfully');
            return data;
        } catch (err: any) {
            console.error('Error updating merchant:', err);
            toast.error('Failed to update merchant', { description: err.message });
            throw err;
        } finally {
            globalLoading = false;
            notifyListeners();
        }
    };

    const deleteMerchant = async (id: string) => {
        const toastId = toast.loading('Initiating deep delete...');
        globalLoading = true;
        notifyListeners();
        try {
            // Using the updated RPC that returns JSONB trace
            const { data, error } = await supabase.rpc('delete_merchants_cascaded', {
                merchant_ids: [id]
            });

            if (error) throw error;

            console.log('Delete Trace:', data);
            await fetchMerchantsGlobal();
            toast.success('Merchant and all associated data deleted successfully', { id: toastId });
        } catch (err: any) {
            console.error('Error deleting merchant:', err);
            toast.error('Failed to delete merchant', {
                id: toastId,
                description: err.message
            });
            throw err;
        } finally {
            globalLoading = false;
            notifyListeners();
        }
    };

    const bulkDeleteMerchants = async (ids: string[]) => {
        const toastId = toast.loading(`Deleting ${ids.length} merchants and their data...`);
        globalLoading = true;
        notifyListeners();
        try {
            const { data, error } = await supabase.rpc('delete_merchants_cascaded', {
                merchant_ids: ids
            });

            if (error) throw error;

            console.log('Bulk Delete Trace:', data);
            await fetchMerchantsGlobal();
            toast.success(`${ids.length} merchants deleted successfully`, { id: toastId });
        } catch (err: any) {
            console.error('Error bulk deleting merchants:', err);
            toast.error('Failed to delete merchants', {
                id: toastId,
                description: err.message
            });
            throw err;
        } finally {
            globalLoading = false;
            notifyListeners();
        }
    };

    const addMerchantBranch = async (branchData: Partial<MerchantBranch>) => {
        try {
            const { data, error } = await supabase
                .from('merchant_branches')
                .insert([branchData])
                .select()
                .single();

            if (error) throw error;
            await fetchMerchantsGlobal();
            toast.success('Branch added successfully');
            return data;
        } catch (err: any) {
            console.error('Error adding branch:', err);
            toast.error('Failed to add branch');
            throw err;
        }
    };

    const deleteMerchantBranch = async (branchId: string) => {
        try {
            const { error } = await supabase
                .from('merchant_branches')
                .delete()
                .eq('id', branchId);

            if (error) throw error;
            await fetchMerchantsGlobal();
            toast.success('Branch deleted');
        } catch (err: any) {
            console.error('Error deleting branch:', err);
            toast.error('Failed to delete branch');
            throw err;
        }
    };

    // Helper for stats logic (kept unrelated to global state for now as it's ad-hoc)
    const getMerchantStats = async (id: string): Promise<MerchantStats> => {
        try {
            const { data, error } = await supabase.rpc('get_merchant_stats', { merchant_id: id });
            if (error) throw error;
            return {
                total_orders: data?.total_orders || 0,
                orders_30d: data?.orders_30d || 0,
                orders_7d: 0,
                total_gmv: data?.total_gmv || 0,
                gmv_30d: data?.gmv_30d || 0,
                gmv_7d: 0,
                avg_order_value: data?.avg_order_value || 0,
                current_rating: 4.5,
                rating_30d_avg: 4.5,
                fulfillment_rate: 98,
                pending_payout: 0,
                top_categories: data?.top_categories || [],
                daily_orders: data?.daily_orders || []
            };
        } catch (e) {
            console.warn('Stats Error or Dev Environment:', e);
            return {
                total_orders: 0,
                orders_30d: 0,
                orders_7d: 0,
                total_gmv: 0,
                gmv_30d: 0,
                gmv_7d: 0,
                avg_order_value: 0,
                current_rating: 0,
                rating_30d_avg: 0,
                fulfillment_rate: 0,
                pending_payout: 0,
                top_categories: [],
                daily_orders: []
            };
        }
    };

    const exportMerchants = async (options: {
        format: 'csv' | 'excel' | 'pdf';
        dateRange?: { from: Date; to: Date };
        fields: string[];
    }) => {
        try {
            let query = supabase.from('merchants').select('*');
            if (options.dateRange) {
                query = query
                    .gte('created_at', options.dateRange.from.toISOString())
                    .lte('created_at', options.dateRange.to.toISOString());
            }
            const { data, error } = await query;
            if (error) throw error;
            if (options.format === 'csv') return generateCSV(data || [], options.fields);
            else return generateCSV(data || [], options.fields);
        } catch (err: any) {
            console.error('Error exporting merchants:', err);
            toast.error('Export failed', { description: err.message });
            throw err;
        }
    };

    return {
        merchants,
        loading,
        error,
        fetchMerchants,
        createMerchant,
        updateMerchant,
        deleteMerchant,
        getMerchantStats,
        exportMerchants,
        addMerchantBranch,
        deleteMerchantBranch,
        bulkDeleteMerchants
    };
}

// Actual fetch logic independent of hook
async function fetchMerchantsGlobal() {
    globalLoading = true;
    notifyListeners();
    try {
        const { data, error } = await supabase
            .from('merchants')
            .select('*, merchant_branches(*)')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Add defaults for computed fields
        const enrichedData = (data || []).map((m: any) => ({
            ...m,
            orders_30d: 0,
            revenue_30d: 0,
            is_online: false,
            last_active: 'Never',
            rating: m.rating || 0
        }));

        globalMerchants = enrichedData;
        globalError = null;
    } catch (err: any) {
        console.error('Error fetching merchants:', err);
        globalError = err.message;
        toast.error('Failed to fetch merchants');
    } finally {
        globalLoading = false;
        notifyListeners();
    }
}

function generateCSV(data: any[], fields: string[]): string {
    if (!data.length) return '';
    const headers = fields.join(',');
    const rows = data.map(item =>
        fields.map(field => {
            const value = item[field];
            if (value === null || value === undefined) return '';
            if (typeof value === 'string' && value.includes(',')) {
                return `"${value}"`;
            }
            return value;
        }).join(',')
    );
    return [headers, ...rows].join('\n');
}
