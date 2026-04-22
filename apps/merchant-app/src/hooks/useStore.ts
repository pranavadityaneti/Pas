import { useStoreContext, Store, Branch, AvailableRole } from '../context/StoreContext';

// Re-export Store, Branch, and AvailableRole types
export type { Store, Branch, AvailableRole };

// Minimal wrapper to maintain backward compatibility
export function useStore() {
    const context = useStoreContext();
    return {
        ...context,
        storeId: context.activeStoreId,
        storeName: (context.store?.id === context.activeStoreId ? context.store?.name : context.branches.find(b => b.id === context.activeStoreId)?.name) || 'My Store',
        // Maintains existing API shape
        // sendHeartbeat is now auto-managed but can be exposed if needed
        sendHeartbeat: () => { },
    };
}
