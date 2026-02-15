export default async function ProductsPage({ params }: { params: Promise<{ category: string }> }) {
    const resolvedParams = await params;
    return (
        <div className="flex min-h-screen flex-col items-center justify-between p-24">
            <h1 className="text-4xl font-bold">Category: {resolvedParams.category}</h1>
            <p>Product listing goes here.</p>
        </div>
    );
}
