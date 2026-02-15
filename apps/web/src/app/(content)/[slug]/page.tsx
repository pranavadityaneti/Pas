export default async function DynamicPage({ params }: { params: Promise<{ slug: string }> }) {
    const resolvedParams = await params;
    return (
        <div className="flex min-h-screen flex-col items-center justify-between p-24">
            <h1 className="text-4xl font-bold">Page: {resolvedParams.slug}</h1>
            <p>Dynamic content for {resolvedParams.slug} will be loaded here.</p>
        </div>
    );
}
