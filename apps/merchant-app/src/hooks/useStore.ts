import { useStoreContext, Store, Branch } from '../context/StoreContext';

// Re-export Store and Branch types
export type { Store, Branch };

// Minimal wrapper to maintain backward compatibility
export function useStore() {
    const context = useStoreContext();
    return {
        ...context,
        // Explicit alias: branchId = the currently active branch UUID
        branchId: context.activeStoreId,
        // Backward compatibility shim for components still pulling activeRole
        activeRole: context.activeContext ? {
            id: context.activeStoreId,
            type: context.activeContext.role,
        } : null,
        sendHeartbeat: () => { },
    };
}
