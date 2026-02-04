import { Outlet } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Header } from './components/Header';
import { Toaster } from './components/ui/sonner';
import { SidebarProvider, SidebarInset } from './components/ui/sidebar';

export default function Layout() {
    return (
        <SidebarProvider>
            <Sidebar />
            <SidebarInset className="bg-gray-50 flex flex-col h-screen overflow-hidden">
                <Header />
                <main className="flex-1 overflow-auto relative">
                    <ErrorBoundary>
                        <Outlet />
                    </ErrorBoundary>
                </main>
            </SidebarInset>
            <Toaster
                position="top-right"
                toastOptions={{
                    classNames: {
                        error: '!bg-white text-red-600 border border-red-100 shadow-lg',
                        success: '!bg-white text-emerald-600 border border-emerald-100 shadow-lg',
                        warning: '!bg-white text-amber-600 border border-amber-100 shadow-lg',
                        info: '!bg-white text-blue-600 border border-blue-100 shadow-lg',
                    }
                }}
            />
        </SidebarProvider>
    );
}
