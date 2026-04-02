import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

export interface Vertical {
    id: string;
    name: string;
    color?: string;
    icon?: string;
}

interface CategoryContextType {
    verticals: Vertical[];
    verticalsLoading: boolean;
    getVerticalName: (id: string) => string;
    getVerticalById: (id: string) => Vertical | undefined;
    refreshVerticals: () => Promise<void>;
}

const CategoryContext = createContext<CategoryContextType | undefined>(undefined);

const CACHE_KEY = 'pas_verticals_cache';

export const CategoryProvider = ({ children }: { children: ReactNode }) => {
    const [verticals, setVerticals] = useState<Vertical[]>([]);
    const [verticalsLoading, setVerticalsLoading] = useState(true);

    const fetchVerticals = async () => {
        try {
            const { data, error } = await supabase
                .from('Vertical')
                .select('id, name, color, icon')
                .order('name', { ascending: true });

            if (error) throw error;

            if (data) {
                setVerticals(data);
                await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
            }
        } catch (err) {
            console.error('Failed to fetch verticals from Supabase:', err);
        } finally {
            setVerticalsLoading(false);
        }
    };

    useEffect(() => {
        const loadCache = async () => {
            try {
                const cachedData = await AsyncStorage.getItem(CACHE_KEY);
                if (cachedData) {
                    setVerticals(JSON.parse(cachedData));
                    setVerticalsLoading(false); // Quick load from cache
                }
            } catch (err) {
                console.error('Failed to load verticals from cache:', err);
            } finally {
                // Always fetch fresh data in background
                fetchVerticals();
            }
        };

        loadCache();
    }, []);

    const getVerticalName = (id: string) => {
        const v = verticals.find(v => v.id === id);
        return v ? v.name : 'Other';
    };

    const getVerticalById = (id: string) => {
        return verticals.find(v => v.id === id);
    };

    return (
        <CategoryContext.Provider value={{ 
            verticals, 
            verticalsLoading, 
            getVerticalName, 
            getVerticalById, 
            refreshVerticals: fetchVerticals 
        }}>
            {children}
        </CategoryContext.Provider>
    );
};

export const useCategories = () => {
    const context = useContext(CategoryContext);
    if (context === undefined) {
        throw new Error('useCategories must be used within a CategoryProvider');
    }
    return context;
};
