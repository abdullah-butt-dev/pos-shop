"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { NavHeader } from "@/components/pos/nav-header";
import { SearchBar } from "@/components/pos/search-bar";
import {
  ProductCard,
  type PurchaseHistoryEntry,
} from "@/components/pos/product-card";
import { OrderSummary } from "@/components/pos/order-summary";
import { CartProvider, useCart } from "@/components/pos/cart-context";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { OrdersLoadingSkeleton } from "@/components/pos/loading-skeleton";
import { PageTransition } from "@/components/ui/page-transition";
import { Clock, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

type PosProduct = {
  id: string;
  name: string;
  unit: string;
  stock: number;
};

function MobileCartButton({ onOpen }: { onOpen: () => void }) {
  const { items } = useCart();
  const itemCount = items.reduce((sum, item) => sum + item.qty, 0);

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
  );
}

function OrdersContent({
  filteredProducts,
  purchaseHistoryMap,
  searchQuery,
  setSearchQuery,
  time,
  loadProducts,
}: {
  filteredProducts: PosProduct[];
  purchaseHistoryMap: Record<string, PurchaseHistoryEntry[]>;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  time: Date | null;
  loadProducts: () => Promise<void>;
}) {
  const [isCartOpen, setIsCartOpen] = useState(false);

  return (
    <main className="h-full w-full flex flex-col overflow-hidden bg-[var(--pos-panel-2)] text-foreground">
      <NavHeader />
      <div className="flex-1 flex flex-col lg:flex-row p-3 gap-3 overflow-hidden">
        {/* Product grid section */}
        <section className="flex-1 flex flex-col gap-3 overflow-hidden p-3 sm:p-4 bg-[var(--pos-panel)] rounded-xl border border-[var(--pos-stroke)]">
          <h1 className="sr-only">Point of Sale</h1>

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex-1 min-w-[180px] max-w-sm">
              <SearchBar onSearch={setSearchQuery} />
            </div>

            {time && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground bg-[var(--pos-panel-2)] border border-[var(--pos-stroke)] rounded-lg font-medium shadow-sm shrink-0 whitespace-nowrap">
                <Clock className="w-3.5 h-3.5 text-[var(--pos-brand)]" />

                <span>
                  {time.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>

                <span className="text-muted-foreground/30">•</span>

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
                  There are no active products matching your search. Add
                  products from the inventory section.
                </p>

                <Link
                  href="/inventory"
                  className="mt-5 px-4 py-2 text-sm font-semibold bg-[var(--pos-brand)] text-black rounded-lg hover:opacity-90 transition"
                >
                  Manage Inventory
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 pb-2 pr-2">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    id={product.id}
                    name={product.name}
                    stock={product.stock}
                    purchaseHistory={purchaseHistoryMap[product.id] || []}
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
          <SheetContent
            side="right"
            className="w-full sm:w-[400px] p-0 border-none bg-transparent"
          >
            <SheetTitle className="sr-only">Order Summary</SheetTitle>
            <OrderSummary refetchData={loadProducts} />
          </SheetContent>
        </Sheet>
      </div>
    </main>
  );
}

export default function OrdersPage() {
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [purchaseHistoryMap, setPurchaseHistoryMap] = useState<
    Record<string, PurchaseHistoryEntry[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    setTime(new Date());

    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);

      const [productsResponse, inventoryResponse, purchasesResponse] =
        await Promise.all([
          fetch("/api/pos/products"),
          fetch("/api/pos/inventory"),
          fetch("/api/pos/purchases"),
        ]);

      const productsJson = await productsResponse.json();
      const inventoryJson = await inventoryResponse.json();
      const purchasesJson = purchasesResponse.ok
        ? await purchasesResponse.json()
        : { data: [] };

      if (!productsResponse.ok || productsJson.error) {
        throw new Error(productsJson.error || "Failed to load products");
      }

      if (!inventoryResponse.ok || inventoryJson.error) {
        throw new Error(inventoryJson.error || "Failed to load inventory");
      }

      const inventoryMap = new Map<
        string,
        {
          quantity: number;
          unit: string;
        }
      >();

      for (const row of inventoryJson.data || []) {
        inventoryMap.set(row.product_id, {
          quantity: Number(row.quantity) || 0,
          unit: row.pos_products?.unit || "unit",
        });
      }

      const mappedProducts: PosProduct[] = (productsJson.data || []).map(
        (product: { id: string; name: string }) => {
          const inventory = inventoryMap.get(product.id);

          return {
            id: product.id,
            name: product.name,
            unit: inventory?.unit || "unit",
            stock: inventory?.quantity || 0,
          };
        },
      );

      setProducts(mappedProducts);

      // Group purchase history by product using combining rule (same supplier + same product + same unit cost)
      const purchasesData = purchasesJson.data || [];

      type GroupAcc = {
        supplierName: string;
        supplierId?: string;
        unitCost: number;
        totalQuantity: number;
        dateMap: Map<string, number>;
      };

      const productGroupsMap = new Map<string, Map<string, GroupAcc>>();

      for (const purchase of purchasesData) {
        const supplierName = purchase.pos_suppliers?.name || "Unknown Supplier";
        const supplierId = purchase.supplier_id;
        const dateRaw = purchase.purchase_date || purchase.created_at;
        const dateFormatted = dateRaw
          ? new Date(dateRaw).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })
          : "";

        for (const item of purchase.pos_purchase_items || []) {
          const prodId = item.product_id;
          if (!prodId) continue;
          const qty = Number(item.quantity) || 0;
          const cost = Number(item.unit_cost) || 0;

          if (!productGroupsMap.has(prodId)) {
            productGroupsMap.set(prodId, new Map());
          }
          const groupMap = productGroupsMap.get(prodId)!;
          const groupKey = `${supplierName}___${cost}`;

          if (!groupMap.has(groupKey)) {
            groupMap.set(groupKey, {
              supplierName,
              supplierId,
              unitCost: cost,
              totalQuantity: 0,
              dateMap: new Map(),
            });
          }

          const acc = groupMap.get(groupKey)!;
          acc.totalQuantity += qty;
          if (dateFormatted) {
            acc.dateMap.set(
              dateFormatted,
              (acc.dateMap.get(dateFormatted) || 0) + qty,
            );
          }
        }
      }

      const computedHistory: Record<string, PurchaseHistoryEntry[]> = {};
      productGroupsMap.forEach((groupMap, prodId) => {
        computedHistory[prodId] = Array.from(groupMap.values()).map((g) => {
          const dateParts: string[] = [];
          g.dateMap.forEach((dateQty, d) => {
            dateParts.push(`${dateQty} on ${d}`);
          });
          return {
            supplierName: g.supplierName,
            supplierId: g.supplierId,
            unitCost: g.unitCost,
            totalQuantity: g.totalQuantity,
            dateBreakdown:
              dateParts.length > 0
                ? dateParts.join(", ")
                : `${g.totalQuantity}`,
          };
        });
      });

      setPurchaseHistoryMap(computedHistory);
    } catch (error) {
      console.error("Failed to load POS products:", error);
      setProducts([]);
      setPurchaseHistoryMap({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const filteredProducts = useMemo(() => {
    if (!debouncedSearchQuery.trim()) {
      return products;
    }

    const query = debouncedSearchQuery.toLowerCase().trim();

    return products.filter((product) =>
      product.name.toLowerCase().includes(query),
    );
  }, [products, debouncedSearchQuery]);

  if (loading) {
    return <OrdersLoadingSkeleton />;
  }

  return (
    <PageTransition>
      <CartProvider>
        <OrdersContent
          filteredProducts={filteredProducts}
          purchaseHistoryMap={purchaseHistoryMap}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          time={time}
          loadProducts={loadProducts}
        />
      </CartProvider>
    </PageTransition>
  );
}
