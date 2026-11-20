import { useState } from 'react';
import defaultLogo from '../../assets/logo.png';
import { brandingMediaUrl } from '../services/apiBase';

const SIZES = {
  xxs: 'h-4 w-auto',
  xs: 'h-7 w-auto',
  sm: 'h-6 w-auto',
  md: 'h-9 w-auto',
  lg: 'h-14 w-auto',
  xl: 'h-12 w-auto',
  tv: 'h-10 w-auto',
  xxl: 'h-20 w-auto',
};

export default function Logo({
  src,
  fallbackSrc = defaultLogo,
  size = 'md',
  alt = '',
  className = '',
  ...props
}) {
  const [failedSrc, setFailedSrc] = useState(null);
  const mediaSrc = brandingMediaUrl(src, 'logo');
  const resolved = mediaSrc && mediaSrc !== failedSrc ? mediaSrc : fallbackSrc;
  const sizeClass = SIZES[size] || size || SIZES.md;

  return (
    <img
      src={resolved}
      alt={alt}
      onError={() => {
        if (mediaSrc && mediaSrc !== failedSrc) setFailedSrc(mediaSrc);
      }}
      className={`${sizeClass} object-contain ${className}`}
      {...props}
    />
  );
}
