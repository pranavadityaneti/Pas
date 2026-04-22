import { useState, useEffect, ImgHTMLAttributes } from 'react';
import { Loader2, FileText, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface SecureImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  path?: string | null;
  bucket: string;
  fallbackText?: string;
}

export function SecureImage({
  path,
  bucket,
  fallbackText = 'No document',
  className,
  ...props
}: SecureImageProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function fetchSignedUrl() {
      if (!path) {
        setSignedUrl(null);
        return;
      }

      setLoading(true);
      setError(false);

      try {
        let storagePath = path;

        // If the database stored a full public URL, extract the relative path
        if (storagePath.startsWith('http')) {
          // Find the bucket name in the URL and get everything after it
          const bucketIndex = storagePath.indexOf(`/${bucket}/`);
          if (bucketIndex !== -1) {
            storagePath = storagePath.substring(bucketIndex + `/${bucket}/`.length);
          } else {
            // Unrecognized URL format, fallback to raw url
            setSignedUrl(storagePath);
            setLoading(false);
            return;
          }
        }

        const { data, error: signedError } = await supabase.storage
          .from(bucket)
          .createSignedUrl(storagePath, 60); // 60 seconds expiry

        if (signedError) {
          throw signedError;
        }

        if (isMounted && data?.signedUrl) {
          setSignedUrl(data.signedUrl);
        }
      } catch (err) {
        console.error('Failed to generate signed URL:', err);
        if (isMounted) setError(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchSignedUrl();

    return () => {
      isMounted = false;
    };
  }, [path, bucket]);

  if (!path) {
    return (
      <div className={`flex flex-col items-center justify-center text-gray-400 bg-gray-50 border-2 border-dashed border-gray-200 ${className}`}>
        <FileText className="w-12 h-12 mb-2 opacity-20" />
        <p className="text-sm">{fallbackText}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-gray-50 ${className}`}>
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !signedUrl) {
    return (
      <div className={`flex flex-col items-center justify-center text-red-400 bg-red-50 border border-red-100 ${className}`}>
        <ImageIcon className="w-10 h-10 mb-2 opacity-50" />
        <p className="text-xs font-medium text-red-600">Failed to load secure image</p>
      </div>
    );
  }

  return (
    <img
      src={signedUrl}
      className={className}
      onError={() => setError(true)}
      {...props}
    />
  );
}
