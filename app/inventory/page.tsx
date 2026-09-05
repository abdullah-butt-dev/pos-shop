"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { NavHeader } from "@/components/pos/nav-header";
import {
  PosInventoryService,
  PosProductService,
  PosSupplierService,
  type PosInventoryRow,
  type PosProductRow,
  type PosSupplierRow,
} from "@/lib/pos-service";
import {
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
  Users,
  Phone,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function InventoryPage() {
  const [products, setProducts] = useState<PosProductRow[]>([]);
  const [suppliers, setSuppliers] = useState<PosSupplierRow[]>([]);
  const [inventoryMap, setInventoryMap] = useState<Map<string, number>>(
    new Map(),
  );

  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<PosProductRow | null>(
    null,
  );
  const [submittingProduct, setSubmittingProduct] = useState(false);

  const [supplierSearchQuery, setSupplierSearchQuery] = useState("");
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<PosSupplierRow | null>(
    null,
  );
  const [submittingSupplier, setSubmittingSupplier] = useState(false);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "product" | "supplier";
    id: string;
    name: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const [productsData, suppliersData, inventoryData] = await Promise.all([
        PosProductService.listAll(),
        PosSupplierService.listAll(),
        PosInventoryService.list(),
      ]);
      const invMap = new Map<string, number>();
      for (const item of inventoryData) {
        invMap.set(item.product_id, Number(item.quantity) || 0);
      }
      setInventoryMap(invMap);
      setProducts(productsData);
      setSuppliers(suppliersData);
    } catch (e) {
      console.error("Failed to load catalog data:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();

    const onFocus = () => {
      load(true);
    };
    window.addEventListener("focus", onFocus);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        load(true);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [load]);

  const productRows = useMemo(() => {
    return products
      .filter(
        (p) =>
          !searchQuery.trim() ||
          p.name.toLowerCase().includes(searchQuery.toLowerCase().trim()),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products, searchQuery]);

  const supplierRows = useMemo(() => {
    return suppliers
      .filter(
        (s) =>
          !supplierSearchQuery.trim() ||
          s.name
            .toLowerCase()
            .includes(supplierSearchQuery.toLowerCase().trim()),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [suppliers, supplierSearchQuery]);

  async function handleProductSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = String(formData.get("name") || "").trim();
    const unit = editingProduct?.unit || "pcs";

    if (!name) {
      toast.error("Product name is required");
      return;
    }

    setSubmittingProduct(true);
    try {
      if (editingProduct) {
        await PosProductService.update(editingProduct.id, { name, unit });
        toast.success("Product updated");
      } else {
        await PosProductService.createFull({ name, unit });
        toast.success("Product added");
      }

      setShowProductForm(false);
      setEditingProduct(null);
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save product",
      );
    } finally {
      setSubmittingProduct(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.type === "product") {
        await PosProductService.delete(deleteTarget.id);
        toast.success("Product deleted");
      } else {
        await PosSupplierService.delete(deleteTarget.id);
        toast.success("Supplier deleted");
      }
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to delete ${deleteTarget.type}`,
      );
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  async function handleSupplierSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = String(formData.get("name") || "").trim();
    const phone = String(formData.get("phone") || "").trim() || null;

    if (!name) {
      toast.error("Supplier name is required");
      return;
    }

    setSubmittingSupplier(true);
    try {
      if (editingSupplier) {
        await PosSupplierService.update(editingSupplier.id, {
          name,
          phone,
        });
        toast.success("Supplier updated");
      } else {
        const created = await PosSupplierService.create(name);
        if (created) {
          if (phone) {
            await PosSupplierService.update(created.id, {
              phone,
            });
          }
          toast.success("Supplier added");
        } else {
          throw new Error("Failed to create supplier");
        }
      }

      setShowSupplierForm(false);
      setEditingSupplier(null);
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save supplier",
      );
    } finally {
      setSubmittingSupplier(false);
    }
  }

  return (
    <main className="h-full w-full flex flex-col overflow-hidden bg-[var(--pos-panel-2)] text-foreground">
      <NavHeader />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 py-5 space-y-5">
          <div>
            <h1 className="text-2xl font-bold">Products & Suppliers</h1>
            <p className="text-sm text-muted-foreground">
              Manage your product catalog and suppliers.
            </p>
          </div>

          <Tabs defaultValue="products" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="products">Products</TabsTrigger>
              <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
            </TabsList>

            <TabsContent value="products" className="space-y-4">
              <div className="pos-panel p-4 rounded-lg flex items-center justify-between flex-wrap gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-8 py-2 rounded-xl border border-[var(--pos-stroke)] bg-[var(--pos-panel-2)] focus:outline-none focus:ring-2 focus:ring-pos-brand text-sm w-64 transition-all"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 hover:bg-foreground/5 rounded-full text-muted-foreground hover:text-foreground transition"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                <button
                  onClick={() => {
                    setEditingProduct(null);
                    setShowProductForm(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-pos-brand text-black font-bold rounded-xl active:scale-[0.98] transition cursor-pointer shadow-sm hover:opacity-90"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Product</span>
                </button>
              </div>

              {loading ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Loading products...
                </p>
              ) : productRows.length === 0 ? (
                <div className="p-8 rounded-xl text-center bg-[var(--pos-panel-2)]/30 border border-dashed border-[var(--pos-stroke)]">
                  <Package className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                  <p className="text-base font-semibold text-foreground">
                    No products found
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    {searchQuery
                      ? "Try refining your search query"
                      : "Add a product here"}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {productRows.map((product) => (
                    <div
                      key={product.id}
                      className="p-4 rounded-xl flex items-center justify-between gap-3 border transition-all duration-200 pos-panel hover:bg-foreground/[0.01]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-blue-500/10 text-blue-600 dark:text-blue-400">
                          <Package className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-foreground truncate">
                            {product.name}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                            <span>Stock:</span>
                            <span
                              className={cn(
                                "font-medium",
                                (inventoryMap.get(product.id) ?? 0) <= 0
                                  ? "text-red-500 font-semibold"
                                  : "text-foreground",
                              )}
                            >
                              {inventoryMap.get(product.id) ?? 0}
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          onClick={() => {
                            setEditingProduct(product);
                            setShowProductForm(true);
                          }}
                          className="p-2 text-blue-600 dark:text-blue-400 bg-blue-500/5 hover:bg-blue-500/10 active:scale-[0.9] border border-blue-500/10 rounded-xl transition duration-150 cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                          title="Edit Product"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if ((product as any).has_records) {
                              toast.error(
                                "Cannot delete: This product has existing purchase or sale records",
                              );
                              return;
                            }
                            setDeleteTarget({
                              type: "product",
                              id: product.id,
                              name: product.name,
                            });
                          }}
                          className={cn(
                            "p-2 border rounded-xl transition duration-150 min-h-[36px] min-w-[36px] flex items-center justify-center",
                            (product as any).has_records
                              ? "text-muted-foreground/30 bg-foreground/5 border-foreground/5 cursor-not-allowed"
                              : "text-red-600 dark:text-red-400 bg-red-500/5 hover:bg-red-500/10 active:scale-[0.9] border-red-500/10 cursor-pointer",
                          )}
                          title={
                            (product as any).has_records
                              ? "Cannot delete: product has existing records"
                              : "Delete Product"
                          }
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="suppliers" className="space-y-4">
              <div className="pos-panel p-4 rounded-lg flex items-center justify-between flex-wrap gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search suppliers..."
                    value={supplierSearchQuery}
                    onChange={(e) => setSupplierSearchQuery(e.target.value)}
                    className="pl-9 pr-8 py-2 rounded-xl border border-[var(--pos-stroke)] bg-[var(--pos-panel-2)] focus:outline-none focus:ring-2 focus:ring-pos-brand text-sm w-64 transition-all"
                  />
                  {supplierSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setSupplierSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 hover:bg-foreground/5 rounded-full text-muted-foreground hover:text-foreground transition"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                <button
                  onClick={() => {
                    setEditingSupplier(null);
                    setShowSupplierForm(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-pos-brand text-black font-bold rounded-xl active:scale-[0.98] transition cursor-pointer shadow-sm hover:opacity-90"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Supplier</span>
                </button>
              </div>

              {loading ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Loading suppliers...
                </p>
              ) : supplierRows.length === 0 ? (
                <div className="p-8 rounded-xl text-center bg-[var(--pos-panel-2)]/30 border border-dashed border-[var(--pos-stroke)]">
                  <Users className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                  <p className="text-base font-semibold text-foreground">
                    No suppliers found
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {supplierRows.map((supplier) => (
                    <div
                      key={supplier.id}
                      className="p-4 rounded-xl flex items-center justify-between gap-3 border transition-all duration-200 pos-panel hover:bg-foreground/[0.01]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                          <Users className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-foreground truncate">
                            {supplier.name}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate flex items-center gap-1">
                            {supplier.phone ? (
                              <>
                                <Phone className="w-3 h-3 text-muted-foreground/70" />
                                {supplier.phone}
                              </>
                            ) : (
                              <span className="text-muted-foreground/50">
                                No phone
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          onClick={() => {
                            setEditingSupplier(supplier);
                            setShowSupplierForm(true);
                          }}
                          className="p-2 text-blue-600 dark:text-blue-400 bg-blue-500/5 hover:bg-blue-500/10 active:scale-[0.9] border border-blue-500/10 rounded-xl transition duration-150 cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                          title="Edit Supplier"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if ((supplier as any).has_records) {
                              toast.error(
                                "Cannot delete: This supplier has existing purchase records",
                              );
                              return;
                            }
                            setDeleteTarget({
                              type: "supplier",
                              id: supplier.id,
                              name: supplier.name,
                            });
                          }}
                          className={cn(
                            "p-2 border rounded-xl transition duration-150 min-h-[36px] min-w-[36px] flex items-center justify-center",
                            (supplier as any).has_records
                              ? "text-muted-foreground/30 bg-foreground/5 border-foreground/5 cursor-not-allowed"
                              : "text-red-600 dark:text-red-400 bg-red-500/5 hover:bg-red-500/10 active:scale-[0.9] border-red-500/10 cursor-pointer",
                          )}
                          title={
                            (supplier as any).has_records
                              ? "Cannot delete: supplier has existing records"
                              : "Delete Supplier"
                          }
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Product Add/Edit Sheet */}
      <Sheet open={showProductForm} onOpenChange={setShowProductForm}>
        <SheetContent className="w-full sm:max-w-md bg-[var(--pos-panel)] border-l border-[var(--pos-stroke)] p-6 flex flex-col gap-6">
          <SheetHeader className="text-left">
            <SheetTitle className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-[var(--pos-brand)]/10 text-[var(--pos-brand)] flex items-center justify-center">
                <Package className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <span className="block font-bold text-base text-foreground">
                  {editingProduct ? "Edit Product" : "Add Product"}
                </span>
                <span className="block text-[11px] font-medium text-muted-foreground mt-0.5">
                  {editingProduct
                    ? "Update product details"
                    : "New products start with zero stock"}
                </span>
              </div>
            </SheetTitle>
          </SheetHeader>

          <form
            onSubmit={handleProductSubmit}
            className="flex-1 flex flex-col gap-5 overflow-y-auto px-1.5 py-1"
          >
            <div className="space-y-2">
              <label
                htmlFor="prod-name"
                className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block"
              >
                Product Name
              </label>
              <input
                id="prod-name"
                name="name"
                placeholder="e.g. Cold Brew Coffee"
                defaultValue={editingProduct?.name}
                required
                className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-pos-brand transition"
              />
            </div>

            {!editingProduct && (
              <p className="text-xs text-muted-foreground bg-foreground/5 rounded-lg p-3">
                Stock is added automatically when you record a purchase for this
                product in <span className="font-semibold">Purchases</span>.
              </p>
            )}

            <div className="mt-auto pt-6 border-t border-[var(--pos-stroke)] flex gap-3">
              <button
                type="button"
                onClick={() => setShowProductForm(false)}
                className="flex-1 py-3 text-center rounded-xl pos-panel border border-[var(--pos-stroke)] bg-foreground/[0.02] text-foreground hover:bg-muted text-sm font-semibold transition active:scale-[0.98] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingProduct}
                className="flex-1 py-3 text-center rounded-xl bg-pos-brand text-black text-sm font-bold transition active:scale-[0.98] cursor-pointer shadow-md shadow-[var(--pos-brand)]/10 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submittingProduct
                  ? "Saving..."
                  : editingProduct
                    ? "Save Changes"
                    : "Create Product"}
              </button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Supplier Add/Edit Sheet */}
      <Sheet open={showSupplierForm} onOpenChange={setShowSupplierForm}>
        <SheetContent className="w-full sm:max-w-md bg-[var(--pos-panel)] border-l border-[var(--pos-stroke)] p-6 flex flex-col gap-6">
          <SheetHeader className="text-left">
            <SheetTitle className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-[var(--pos-brand)]/10 text-[var(--pos-brand)] flex items-center justify-center">
                <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <span className="block font-bold text-base text-foreground">
                  {editingSupplier ? "Edit Supplier" : "Add Supplier"}
                </span>
                <span className="block text-[11px] font-medium text-muted-foreground mt-0.5">
                  Manage supplier contact details
                </span>
              </div>
            </SheetTitle>
          </SheetHeader>

          <form
            onSubmit={handleSupplierSubmit}
            className="flex-1 flex flex-col gap-5 overflow-y-auto px-1.5 py-1"
          >
            <div className="space-y-2">
              <label
                htmlFor="sup-name"
                className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block"
              >
                Supplier Name
              </label>
              <input
                id="sup-name"
                name="name"
                placeholder="e.g. Perfect Traders"
                defaultValue={editingSupplier?.name}
                required
                className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-pos-brand transition"
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="sup-phone"
                className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block"
              >
                Phone
              </label>
              <input
                id="sup-phone"
                name="phone"
                placeholder="e.g. 03134640267"
                defaultValue={editingSupplier?.phone || ""}
                className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-pos-brand transition"
              />
            </div>

            <div className="mt-auto pt-6 border-t border-[var(--pos-stroke)] flex gap-3">
              <button
                type="button"
                onClick={() => setShowSupplierForm(false)}
                className="flex-1 py-3 text-center rounded-xl pos-panel border border-[var(--pos-stroke)] bg-foreground/[0.02] text-foreground hover:bg-muted text-sm font-semibold transition active:scale-[0.98] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingSupplier}
                className="flex-1 py-3 text-center rounded-xl bg-pos-brand text-black text-sm font-bold transition active:scale-[0.98] cursor-pointer shadow-md shadow-[var(--pos-brand)]/10 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submittingSupplier
                  ? "Saving..."
                  : editingSupplier
                    ? "Save Changes"
                    : "Create Supplier"}
              </button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteTarget?.type === "product" ? "Product" : "Supplier"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold text-foreground">
                {deleteTarget?.name}
              </span>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
