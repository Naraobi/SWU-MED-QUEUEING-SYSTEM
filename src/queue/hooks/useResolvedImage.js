import { useEffect, useState } from 'react';

export default function useResolvedImage(source, fallback) {
  const [loadedSource, setLoadedSource] = useState(null);
  const [failedSource, setFailedSource] = useState(null);

  useEffect(() => {
    let cancelled = false;

    if (!source || source === fallback) return undefined;

    const image = new Image();

    image.onload = () => {
      if (!cancelled) setLoadedSource(source);
    };

    image.onerror = () => {
      if (!cancelled) setFailedSource(source);
    };

    image.src = source;

    return () => {
      cancelled = true;
    };
  }, [source, fallback]);

  const canUseSource =
    source &&
    source !== fallback &&
    source !== failedSource &&
    source === loadedSource;

  return canUseSource ? source : fallback;
}
