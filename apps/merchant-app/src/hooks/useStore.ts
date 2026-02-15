import { useStoreContext, Store } from '../context/StoreContext';

// Re-export Store type
export type { Store };

// Minimal wrapper to maintain backward compatibility
export function useStore() {
    const context = useStoreContext();
    return {
        ...context,
        storeId: context.store?.id || null,
        storeName: context.store?.name || null,
        // Maintains existing API shape
        // sendHeartbeat is now auto-managed but can be exposed if needed
        sendHeartbeat: () => { },
    };
}
