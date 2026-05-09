import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createBranchManager, CreateManagerPayload } from '../services/staff';

export const useCreateManager = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateManagerPayload) => createBranchManager(payload),
    onSuccess: (_, variables) => {
      // Invalidate the store staff queries so the UI immediately updates with the new manager
      queryClient.invalidateQueries({
        queryKey: ['store_staff', variables.storeId]
      });
    },
    onError: (error: Error) => {
      console.error('Create manager error:', error.message);
      // Wire this up to a toast notification system in your UI component
    }
  });
};
