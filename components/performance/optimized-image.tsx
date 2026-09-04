"use client"

import { useState, useRef, useEffect } from 'react'
import { useLazyLoad } from './lazy-loader'

interface OptimizedImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  className?: string
  priority?: boolean
  placeholder?: string
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className = '',
  priority = false,
  placeholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PC9zdmc+'
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)
  const { ref, isVisible } = useLazyLoad(0.1)
  const imgRef = useRef<HTMLImageElement>(null)

  const shouldLoad = priority || isVisible

  useEffect(() => {
    if (shouldLoad && imgRef.current && !isLoaded) {
      const img = imgRef.current
      
      const handleLoad = () => setIsLoaded(true)
      const handleError = () => setHasError(true)
      
      img.addEventListener('load', handleLoad)
      img.addEventListener('error', handleError)
      
      return () => {
        img.removeEventListener('load', handleLoad)
        img.removeEventListener('error', handleError)
      }
    }
  }, [shouldLoad, isLoaded])

  return (
    <div ref={ref} className={`relative overflow-hidden ${className}`}>
      {shouldLoad && (
        <>
          {!isLoaded && !hasError && (
            <img
              src={placeholder}
              alt=""
              className="absolute inset-0 w-full h-full object-cover blur-sm"
              aria-hidden="true"
            />
          )}
          <img
            ref={imgRef}
            src={src}
            alt={alt}
            width={width}
            height={height}
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              isLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
          />
          {hasError && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-200 text-gray-500">
              <span className="text-sm">Failed to load image</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}
