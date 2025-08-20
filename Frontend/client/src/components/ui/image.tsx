import { useState } from 'react';
import { cn } from "@/lib/utils";

interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  fallbackSrc?: string;
  className?: string;
}

export function Image({ 
  src, 
  alt, 
  fallbackSrc = './images/fallback.svg', 
  className,
  ...props 
}: ImageProps) {
  const [imgSrc, setImgSrc] = useState<string>(src);
  const [isError, setIsError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;

  const handleError = () => {
    if (!isError && retryCount < MAX_RETRIES) {
      // Retry loading the original image with a cache buster
      setRetryCount(prev => prev + 1);
      setImgSrc(`${src}?retry=${retryCount + 1}`);
    } else if (!isError) {
      setImgSrc(fallbackSrc);
      setIsError(true);
    }
  };

  return (
    <img
      src={imgSrc}
      alt={alt}
      onError={handleError}
      className={cn(
        "max-w-full h-auto transition-opacity duration-300",
        className
      )}
      {...props}
    />
  );
}