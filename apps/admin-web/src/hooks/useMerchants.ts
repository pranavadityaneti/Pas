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

export function useMerchants() {
    const [merchants, setMerchants] = useState<Merchant[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch all merchants
    const fetchMerchants = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, error } = await supabase
                .from('merchants')
                .select('*, merchant_branches(*)')
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Add defaults for computed fields
            const enrichedData = (data || []).map((m: any) => ({
                ...m,
                orders_30d: 0, // Default to 0 until we have real orders
                revenue_30d: 0, // Default to 0
                is_online: false, // Default to offline
                last_active: 'Never',
                rating: m.rating || 0
            }));

            setMerchants(enrichedData);
            return enrichedData;
        } catch (err: any) {
            console.error('Error fetching merchants:', err);
            setError(err.message);
            return [];
        } finally {
            setLoading(false);
        }
    }, []);



    // Helper to upload file
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

    // Create new merchant
    const createMerchant = async (
        merchantData: Partial<Merchant>,
        files?: { pan?: File | null, aadharFront?: File | null, aadharBack?: File | null }
    ) => {
        setLoading(true);
        try {
            // Upload files if present
            let panUrl = '';
            let aadharFrontUrl = '';
            let aadharBackUrl = '';

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
                        aadhar_back_url: aadharBackUrl || null
                    }
                ])
                .select()
                .single();

            if (error) throw error;

            await fetchMerchants();
            toast.success('Merchant application submitted successfully');
            return data;
        } catch (err: any) {
            console.error('Error creating merchant:', err);
            toast.error('Failed to create merchant', { description: err.message });
            throw err;
        } finally {
            setLoading(false);
        }
    };

    // Update merchant
    const updateMerchant = async (id: string, updates: Partial<Merchant>) => {
        setLoading(true);
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

            await fetchMerchants();
            toast.success('Merchant updated successfully');
            return data;
        } catch (err: any) {
            console.error('Error updating merchant:', err);
            toast.error('Failed to update merchant', { description: err.message });
            throw err;
        } finally {
            setLoading(false);
        }
    };

    // Delete merchant
    const deleteMerchant = async (id: string) => {
        setLoading(true);
        try {
            const { error } = await supabase
                .from('merchants')
                .delete()
                .eq('id', id);

            if (error) throw error;

            await fetchMerchants();
            toast.success('Merchant deleted successfully');
        } catch (err: any) {
            console.error('Error deleting merchant:', err);
            toast.error('Failed to delete merchant', { description: err.message });
            throw err;
        } finally {
            setLoading(false);
        }
    };

    // Branch operations
    const addMerchantBranch = async (branchData: Partial<MerchantBranch>) => {
        try {
            const { data, error } = await supabase
                .from('merchant_branches')
                .insert([branchData])
                .select()
                .single();

            if (error) throw error;
            await fetchMerchants(); // Refresh
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
            await fetchMerchants();
            toast.success('Branch deleted');
        } catch (err: any) {
            console.error('Error deleting branch:', err);
            toast.error('Failed to delete branch');
            throw err;
        }
    };

    // Get merchant stats for report
    const getMerchantStats = async (id: string): Promise<MerchantStats> => {
        try {
            const { data, error } = await supabase.rpc('get_merchant_stats', { merchant_id: id });

            if (error) throw error;

            // Transform RPC result to UI model
            return {
                total_orders: data.total_orders || 0,
                orders_30d: data.orders_30d || 0,
                orders_7d: 0,
                total_gmv: data.total_gmv || 0,
                gmv_30d: data.gmv_30d || 0,
                gmv_7d: 0,
                avg_order_value: data.avg_order_value || 0,
                current_rating: 4.5, // Fallback as not in orders table
                rating_30d_avg: 4.5,
                fulfillment_rate: 98,
                pending_payout: 0,
                top_categories: data.top_categories || [],
                daily_orders: data.daily_orders || []
            };
        } catch (e) {
            console.error('Stats Error:', e);
            // Fallback for dev if RPC fails
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

    // Export merchants (with filters)
    const exportMerchants = async (options: {
        format: 'csv' | 'excel' | 'pdf';
        dateRange?: { from: Date; to: Date };
        fields: string[];
    }) => {
        try {
            let query = supabase
                .from('merchants')
                .select('*');

            if (options.dateRange) {
                query = query
                    .gte('created_at', options.dateRange.from.toISOString())
                    .lte('created_at', options.dateRange.to.toISOString());
            }

            const { data, error } = await query;
            if (error) throw error;

            // Generate export based on format
            if (options.format === 'csv') {
                return generateCSV(data || [], options.fields);
            } else if (options.format === 'excel') {
                return generateCSV(data || [], options.fields); // Simplified - same as CSV for now
            } else {
                return generateCSV(data || [], options.fields); // PDF would need different handling
            }
        } catch (err: any) {
            console.error('Error exporting merchants:', err);
            toast.error('Export failed', { description: err.message });
            throw err;
        }
    };

    // Auto-fetch on mount
    useEffect(() => {
        fetchMerchants();
    }, [fetchMerchants]);

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
        deleteMerchantBranch
    };
}

// Helper to generate CSV
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
