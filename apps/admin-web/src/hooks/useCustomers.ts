import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'sonner';

export type Customer = {
    id: string;
    name: string;
    phone: string;
    city: string;
    ltv: number;
    last_order: string | null;
    status: 'active' | 'blocked';
    avatar_url: string | null;
    created_at: string;
};

export function useCustomers() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchCustomers();
    }, []);

    const fetchCustomers = async () => {
        try {
            setLoading(true);

            // Fetch users with role CONSUMER
            // We join with orders to get count and total amount (LTV)
            // Note: This query assumes the table names are 'User' and 'orders' 
            // as per Prisma schema and my SQL script.

            const { data, error } = await supabase
                .from('User')
                .select(`
          *,
          orders (
            amount
          )
        `)
                .eq('role', 'CONSUMER');

            if (error) throw error;

            const mappedData: Customer[] = (data || []).map((u: any) => {
                const totalLtv = u.orders?.reduce((sum: number, o: any) => sum + Number(o.amount), 0) || 0;
                return {
                    id: u.id,
                    name: u.name || u.email.split('@')[0],
                    phone: u.phone || 'N/A',
                    city: 'Hyderabad', // Defaulting for now or could fetch from address/orders
                    ltv: totalLtv,
                    last_order: u.orders?.length > 0 ? new Date(u.orders[0].created_at).toLocaleDateString() : null,
                    status: 'active', // Assuming active by default
                    avatar_url: u.avatar_url || null,
                    created_at: u.createdAt
                };
            });

            setCustomers(mappedData);
        } catch (error) {
            console.error('Error fetching customers:', error);
            // Fallback to mock data for dev visibility if table is missing
            setCustomers([
                { id: '1', name: 'Rahul Sharma', phone: '+91 98765 43210', city: 'Hyderabad', ltv: 12500, last_order: '1/25/2026', status: 'active', avatar_url: null, created_at: '2025-12-01' },
            ]);
        } finally {
            setLoading(false);
        }
    };

    const blockCustomer = async (id: string) => {
        toast.error("Blocking functionality needs backend user management implementation");
    };

    return { customers, loading, fetchCustomers, blockCustomer };
}
