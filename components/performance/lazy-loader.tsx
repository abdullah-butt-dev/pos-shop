"use client"

import { lazy, Suspense, ComponentType, useState, useRef, useEffect } from 'react'
import { OrdersLoadingSkeleton } from '@/components/pos/loading-skeleton'

// Generic lazy loading wrapper with optimized loading states
export function createLazyComponent<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  fallback?: React.ReactNode
) {
  const LazyComponent = lazy(importFunc)
  
  return function LazyWrapper(props: React.ComponentProps<T>) {
    return (
      <Suspense fallback={fallback || <OrdersLoadingSkeleton />}>
        <LazyComponent {...props} />
      </Suspense>
    )
  }
}

// Intersection Observer for lazy loading components when they come into view
export function useLazyLoad(threshold = 0.1) {
  const [isVisible, setIsVisible] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasLoaded) {
          setIsVisible(true)
          setHasLoaded(true)
          observer.disconnect()
        }
      },
      { threshold }
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => observer.disconnect()
  }, [threshold, hasLoaded])

  return { ref, isVisible, hasLoaded }
}

// Performance monitoring component
export function PerformanceMonitor({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Monitor Core Web Vitals
    if (typeof window !== 'undefined' && 'performance' in window) {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          console.log(`Performance metric: ${entry.name}`, entry)
        })
      })
      
      observer.observe({ entryTypes: ['measure', 'navigation'] })
      
      return () => observer.disconnect()
    }
  }, [])

  return <>{children}</>
}
