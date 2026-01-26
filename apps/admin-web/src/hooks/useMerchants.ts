import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'sonner';

export function useMerchants() {
    const [loading, setLoading] = useState(false);

    const createMerchant = async (merchantData: any) => {
        setLoading(true);
        try {
            // 1. Insert into 'merchants' table
            const { data, error } = await supabase
                .from('merchants')
                .insert([
                    {
                        store_name: merchantData.name,
                        owner_name: merchantData.ownerName,
                        email: merchantData.email,
                        phone: merchantData.phone,
                        city: merchantData.city,
                        address: merchantData.address,
                        latitude: merchantData.latitude,
                        longitude: merchantData.longitude,
                        has_branches: merchantData.hasBranches,
                        kyc_status: 'pending',
                        status: 'active'
                    }
                ])
                .select()
                .single();

            if (error) throw error;
            return data;

        } catch (error: any) {
            console.error('Error creating merchant:', error);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    return {
        createMerchant,
        loading
    };
}
