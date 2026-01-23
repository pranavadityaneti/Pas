export interface User {
    id: string;
    email: string;
    role: 'SUPER_ADMIN' | 'MERCHANT' | 'CONSUMER';
    name?: string;
}
export interface City {
    id: string;
    name: string;
    active: boolean;
}
