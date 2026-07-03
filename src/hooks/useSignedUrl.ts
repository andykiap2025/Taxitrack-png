import { useEffect, useState } from 'react';

import { signedUrl } from '@/lib/storage';

/** Resolves a private storage path to a temporary signed URL for display. */
export function useSignedUrl(bucket: string, path: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!path) {
      setUrl(null);
      return;
    }
    signedUrl(bucket, path).then((u) => {
      if (active) setUrl(u);
    });
    return () => {
      active = false;
    };
  }, [bucket, path]);

  return url;
}
