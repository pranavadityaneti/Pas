import { supabase } from '../lib/supabase';
import axios from 'axios';

// Ensure you have an environment variable for your API URL
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export interface CreateManagerPayload {
  name: string;
  phone: string;
  storeId: string;
}

export const createBranchManager = async (payload: CreateManagerPayload) => {
  // Retrieve the current user's session to get the JWT
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    throw new Error('No valid session found. Please log in again.');
  }

  try {
    const response = await axios.post(`${API_URL}/api/staff/create-manager`, payload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      }
    });

    return response.data;
  } catch (error: any) {
    // Surface the human-readable error from the backend (e.g., Owner-Only guard failure)
    if (error.response?.data?.error) {
      throw new Error(error.response.data.error);
    }
    throw new Error('Failed to create branch manager. Please check your connection.');
  }
};
