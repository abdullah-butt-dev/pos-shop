"use client"

import { useEffect, useCallback, useRef } from 'react'

// Performance optimization hook
export function usePerformance() {
  const performanceRef = useRef<{
    startTime: number
    metrics: Record<string, number>
  }>({
    startTime: Date.now(),
    metrics: {}
  })

  // Measure component render time
  const measureRender = useCallback((componentName: string) => {
    const start = performance.now()
    
    return () => {
      const end = performance.now()
      const duration = end - start
      performanceRef.current.metrics[componentName] = duration
      
      if (duration > 16) { // Slower than 60fps
        console.warn(`Slow render detected: ${componentName} took ${duration.toFixed(2)}ms`)
      }
    }
  }, [])

  // Debounce function for performance
  const debounce = useCallback(<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): ((...args: Parameters<T>) => void) => {
    let timeout: NodeJS.Timeout
    
    return (...args: Parameters<T>) => {
      clearTimeout(timeout)
      timeout = setTimeout(() => func(...args), wait)
    }
  }, [])

  // Throttle function for performance
  const throttle = useCallback(<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): ((...args: Parameters<T>) => void) => {
    let inThrottle: boolean
    
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args)
        inThrottle = true
        setTimeout(() => inThrottle = false, limit)
      }
    }
  }, [])

  // Optimize heavy computations
  const optimizeComputation = useCallback(<T>(
    computation: () => T,
    dependencies: any[],
    threshold = 5 // ms
  ): T => {
    const start = performance.now()
    const result = computation()
    const duration = performance.now() - start
    
    if (duration > threshold) {
      console.warn(`Heavy computation detected: ${duration.toFixed(2)}ms`)
    }
    
    return result
  }, [])

  // Memory usage monitoring
  const checkMemoryUsage = useCallback(() => {
    if ('memory' in performance) {
      const memory = (performance as any).memory
      const used = memory.usedJSHeapSize / 1048576 // Convert to MB
      const total = memory.totalJSHeapSize / 1048576
      
      if (used > 50) { // More than 50MB
        console.warn(`High memory usage: ${used.toFixed(2)}MB / ${total.toFixed(2)}MB`)
      }
      
      return { used, total, percentage: (used / total) * 100 }
    }
    return null
  }, [])

  // Intersection Observer for viewport optimization
  const createViewportObserver = useCallback((
    callback: (entries: IntersectionObserverEntry[]) => void,
    options?: IntersectionObserverInit
  ) => {
    if (typeof window === 'undefined') return null
    
    return new IntersectionObserver(callback, {
      threshold: 0.1,
      rootMargin: '50px',
      ...options
    })
  }, [])

  // Resource preloading
  const preloadResource = useCallback((url: string, type: 'script' | 'style' | 'image' | 'fetch') => {
    if (typeof window === 'undefined') return
    
    const link = document.createElement('link')
    link.rel = 'preload'
    link.href = url
    
    switch (type) {
      case 'script':
        link.as = 'script'
        break
      case 'style':
        link.as = 'style'
        break
      case 'image':
        link.as = 'image'
        break
      case 'fetch':
        link.as = 'fetch'
        link.crossOrigin = 'anonymous'
        break
    }
    
    document.head.appendChild(link)
  }, [])

  // Critical resource hints
  const addResourceHints = useCallback((hints: Array<{
    url: string
    type: 'preconnect' | 'dns-prefetch' | 'preload' | 'prefetch'
    as?: string
  }>) => {
    if (typeof window === 'undefined') return
    
    hints.forEach(({ url, type, as }) => {
      const link = document.createElement('link')
      link.rel = type
      link.href = url
      if (as) link.as = as
      if (type === 'preconnect') link.crossOrigin = 'anonymous'
      
      document.head.appendChild(link)
    })
  }, [])

  // Performance monitoring
  useEffect(() => {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.entryType === 'navigation') {
          const nav = entry as PerformanceNavigationTiming
          console.log('Navigation timing:', {
            domContentLoaded: nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart,
            loadComplete: nav.loadEventEnd - nav.loadEventStart,
            firstPaint: nav.responseEnd - nav.requestStart
          })
        }
        
        if (entry.entryType === 'largest-contentful-paint') {
          console.log('LCP:', entry.startTime)
        }
        
        if (entry.entryType === 'first-input') {
          const fidEntry = entry as PerformanceEventTiming
          console.log('FID:', fidEntry.processingStart - fidEntry.startTime)
        }
      })
    })
    
    observer.observe({ entryTypes: ['navigation', 'largest-contentful-paint', 'first-input'] })
    
    return () => observer.disconnect()
  }, [])

  return {
    measureRender,
    debounce,
    throttle,
    optimizeComputation,
    checkMemoryUsage,
    createViewportObserver,
    preloadResource,
    addResourceHints,
    metrics: performanceRef.current.metrics
  }
}
