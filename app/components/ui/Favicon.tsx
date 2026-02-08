"use client";

import React, { useState, memo } from "react";
import { getFaviconUrl } from "@/app/lib/favicon";

interface FaviconProps {
  url: string;
  size?: number;
  className?: string;
  alt?: string;
}

function FaviconComponent({ url, size = 16, className = "w-4 h-4", alt = "" }: FaviconProps) {
  const [imageError, setImageError] = useState(false);
  const faviconUrl = getFaviconUrl(url, size);

  if (!faviconUrl || imageError) {
    return null;
  }

  return (
    <img
      src={faviconUrl}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setImageError(true)}
    />
  );
}

export const Favicon = memo(FaviconComponent, (prevProps, nextProps) => {
  return (
    prevProps.url === nextProps.url &&
    prevProps.size === nextProps.size &&
    prevProps.className === nextProps.className &&
    prevProps.alt === nextProps.alt
  );
});
