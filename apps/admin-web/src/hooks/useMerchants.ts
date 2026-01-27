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
    // Computed/joined fields
    orders_30d?: number;
    revenue_30d?: number;
    is_online?: boolean;
    last_active?: string;
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
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Add mock computed fields for now (will be replaced with real aggregations)
            const enrichedData = (data || []).map((m: any) => ({
                ...m,
                orders_30d: Math.floor(Math.random() * 500) + 50,
                revenue_30d: Math.floor(Math.random() * 500000) + 50000,
                is_online: Math.random() > 0.3,
                last_active: Math.random() > 0.5 ? '2 min ago' : '3 hrs ago',
                rating: m.rating || (Math.random() * 2 + 3).toFixed(1)
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

    // Create new merchant
    const createMerchant = async (merchantData: Partial<Merchant>) => {
        setLoading(true);
        try {
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
                        operating_hours: merchantData.operating_hours
                    }
                ])
                .select()
                .single();

            if (error) throw error;

            await fetchMerchants();
            toast.success('Merchant created successfully');
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

    // Get merchant stats for report
    const getMerchantStats = async (id: string): Promise<MerchantStats> => {
        // For now, return mock stats. In production, this would query orders table
        // and aggregate data from Supabase
        return {
            total_orders: Math.floor(Math.random() * 2000) + 500,
            orders_30d: Math.floor(Math.random() * 400) + 100,
            orders_7d: Math.floor(Math.random() * 100) + 20,
            total_gmv: Math.floor(Math.random() * 5000000) + 1000000,
            gmv_30d: Math.floor(Math.random() * 500000) + 100000,
            gmv_7d: Math.floor(Math.random() * 100000) + 20000,
            avg_order_value: Math.floor(Math.random() * 800) + 200,
            current_rating: parseFloat((Math.random() * 2 + 3).toFixed(1)),
            rating_30d_avg: parseFloat((Math.random() * 2 + 3).toFixed(1)),
            fulfillment_rate: Math.floor(Math.random() * 15) + 85,
            pending_payout: Math.floor(Math.random() * 50000) + 5000,
            top_categories: [
                { name: 'Groceries', count: Math.floor(Math.random() * 100) + 50 },
                { name: 'Dairy', count: Math.floor(Math.random() * 80) + 30 },
                { name: 'Beverages', count: Math.floor(Math.random() * 60) + 20 },
                { name: 'Snacks', count: Math.floor(Math.random() * 50) + 15 },
            ],
            daily_orders: Array.from({ length: 30 }, (_, i) => ({
                date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                orders: Math.floor(Math.random() * 30) + 5,
                gmv: Math.floor(Math.random() * 30000) + 5000
            }))
        };
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
        exportMerchants
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
