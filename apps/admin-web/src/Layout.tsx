import { Outlet } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
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
                    <Outlet />
                </main>
            </SidebarInset>
            <Toaster />
        </SidebarProvider>
    );
}
