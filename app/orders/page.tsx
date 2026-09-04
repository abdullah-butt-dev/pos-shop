"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { NavHeader } from "@/components/pos/nav-header"
import { SearchBar } from "@/components/pos/search-bar"
import { ProductCard } from "@/components/pos/product-card"
import { OrderSummary } from "@/components/pos/order-summary"
import { CartProvider, useCart } from "@/components/pos/cart-context"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { OrdersLoadingSkeleton } from "@/components/pos/loading-skeleton"
import { PageTransition } from "@/components/ui/page-transition"
import { Clock, ShoppingBag } from "lucide-react"
import Link from "next/link"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"

type PosProduct = {
  id: string
  name: string
  unit: string
  stock: number
}

function MobileCartButton({ onOpen }: { onOpen: () => void }) {
  const { items } = useCart()
  const itemCount = items.reduce((sum, item) => sum + item.qty, 0)
  
  return (
    <button
      onClick={onOpen}
      className="lg:hidden fixed bottom-6 right-6 p-4 bg-[var(--pos-brand)] text-black rounded-full shadow-lg hover:opacity-90 transition z-50 flex items-center justify-center"
    >
      <ShoppingBag className="w-6 h-6" />
      {itemCount > 0 && (
        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full">
          {itemCount}
        </span>
      )}
    </button>
  )
}

function OrdersContent({
  filteredProducts,
  searchQuery,
  setSearchQuery,
  time,
  loadProducts
}: {
  filteredProducts: PosProduct[]
  searchQuery: string
  setSearchQuery: (query: string) => void
  time: Date | null
  loadProducts: () => Promise<void>
}) {
  const [isCartOpen, setIsCartOpen] = useState(false)

  return (
    <main className="h-full w-full flex flex-col overflow-hidden bg-[var(--pos-panel-2)] text-foreground">
      <NavHeader />
      <div className="flex-1 flex flex-col lg:flex-row p-3 gap-3 overflow-hidden">
        {/* Product grid section */}
        <section className="flex-1 flex flex-col gap-3 overflow-hidden p-3 sm:p-4 bg-[var(--pos-panel)] rounded-xl border border-[var(--pos-stroke)]">
          <h1 className="sr-only">Point of Sale</h1>

          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <SearchBar onSearch={setSearchQuery} />

              {time && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground bg-[var(--pos-panel-2)] border border-[var(--pos-stroke)] rounded-lg font-medium shadow-sm">
                  <Clock className="w-3.5 h-3.5 text-[var(--pos-brand)]" />

                  <span>
                    {time.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>

                  <span className="text-muted-foreground/30">
                    •
                  </span>

                  <span>
                    {time.toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-600 dark:scrollbar-thumb-gray-400">
            {filteredProducts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-[var(--pos-panel)] border border-[var(--pos-stroke)] rounded-xl my-2 mr-2">
                <div className="p-4 rounded-full bg-muted/50 mb-4">
                  <ShoppingBag className="w-12 h-12 text-muted-foreground" />
                </div>

                <h3 className="text-lg font-medium text-foreground">
                  No products found
                </h3>

                <p className="text-sm text-muted-foreground/75 mt-1 max-w-sm">
                  There are no active products matching your search.
                  Add products from the inventory section.
                </p>

                <Link
                  href="/inventory"
                  className="mt-5 px-4 py-2 text-sm font-semibold bg-[var(--pos-brand)] text-black rounded-lg hover:opacity-90 transition"
                >
                  Manage Inventory
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 pb-2 pr-2">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    id={product.id}
                    name={product.name}
                    stock={product.stock}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Desktop Order Summary */}
        <aside className="hidden lg:flex w-96 shrink-0">
          <OrderSummary refetchData={loadProducts} />
        </aside>

        {/* Mobile Cart Button */}
        <MobileCartButton onOpen={() => setIsCartOpen(true)} />

        {/* Mobile Order Summary Sheet */}
        <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
          <SheetContent side="right" className="w-full sm:w-[400px] p-0 border-none bg-transparent">
            <SheetTitle className="sr-only">Order Summary</SheetTitle>
            <OrderSummary refetchData={loadProducts} />
          </SheetContent>
        </Sheet>
      </div>
    </main>
  )
}

export default function OrdersPage() {
  const [products, setProducts] = useState<PosProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [time, setTime] = useState<Date | null>(null)

  useEffect(() => {
    setTime(new Date())

    const timer = setInterval(() => {
      setTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300)

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true)

      const [productsResponse, inventoryResponse] = await Promise.all([
        fetch("/api/pos/products"),
        fetch("/api/pos/inventory"),
      ])

      const productsJson = await productsResponse.json()
      const inventoryJson = await inventoryResponse.json()

      if (!productsResponse.ok || productsJson.error) {
        throw new Error(productsJson.error || "Failed to load products")
      }

      if (!inventoryResponse.ok || inventoryJson.error) {
        throw new Error(inventoryJson.error || "Failed to load inventory")
      }

      const inventoryMap = new Map<
        string,
        {
          quantity: number
          unit: string
        }
      >()

      for (const row of inventoryJson.data || []) {
        inventoryMap.set(row.product_id, {
          quantity: Number(row.quantity) || 0,
          unit: row.pos_products?.unit || "unit",
        })
      }

      const mappedProducts: PosProduct[] = (productsJson.data || []).map(
        (product: { id: string; name: string }) => {
          const inventory = inventoryMap.get(product.id)

          return {
            id: product.id,
            name: product.name,
            unit: inventory?.unit || "unit",
            stock: inventory?.quantity || 0,
          }
        },
      )

      setProducts(mappedProducts)
    } catch (error) {
      console.error("Failed to load POS products:", error)
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  const filteredProducts = useMemo(() => {
    if (!debouncedSearchQuery.trim()) {
      return products
    }

    const query = debouncedSearchQuery.toLowerCase().trim()

    return products.filter((product) =>
      product.name.toLowerCase().includes(query),
    )
  }, [products, debouncedSearchQuery])

  if (loading) {
    return <OrdersLoadingSkeleton />
  }

  return (
    <PageTransition>
      <CartProvider>
        <OrdersContent
          filteredProducts={filteredProducts}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          time={time}
          loadProducts={loadProducts}
        />
      </CartProvider>
    </PageTransition>
  )
}
