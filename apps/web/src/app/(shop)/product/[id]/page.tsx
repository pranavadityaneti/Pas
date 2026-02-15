export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = await params;
    return (
        <div className="flex min-h-screen flex-col items-center justify-between p-24">
            <h1 className="text-4xl font-bold">Product ID: {resolvedParams.id}</h1>
            <p>Product details go here.</p>
        </div>
    );
}
