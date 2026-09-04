"use client"

import type React from "react"
import {
  createContext,
  useContext,
  useMemo,
  useState,
} from "react"

export type CartItem = {
  id: string
  name: string
  price: number
  qty: number
}

type CartCtx = {
  items: CartItem[]
  add: (item: Omit<CartItem, "qty">) => void
  inc: (id: string) => void
  dec: (id: string) => void
  setQty: (id: string, qty: number) => void
  setPrice: (id: string, price: number) => void
  remove: (id: string) => void
  subtotal: number
  clear: () => void
}

const Ctx = createContext<CartCtx | null>(null)

export function CartProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [items, setItems] = useState<CartItem[]>([])

  const add = (item: Omit<CartItem, "qty">) =>
    setItems((prev) => {
      const found = prev.find((p) => p.id === item.id)

      if (found) {
        return prev.map((p) =>
          p.id === item.id
            ? {
                ...p,
                qty: p.qty + 1,
              }
            : p,
        )
      }

      return [
        ...prev,
        {
          ...item,
          qty: 1,
        },
      ]
    })

  const inc = (id: string) =>
    setItems((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              qty: p.qty + 1,
            }
          : p,
      ),
    )

  const dec = (id: string) =>
    setItems((prev) =>
      prev
        .map((p) =>
          p.id === id
            ? {
                ...p,
                qty: Math.max(0, p.qty - 1),
              }
            : p,
        )
        .filter((p) => p.qty > 0),
    )

  const setQty = (id: string, qty: number) => {
    if (!Number.isFinite(qty) || qty <= 0) {
      setItems((prev) => prev.filter((p) => p.id !== id))
      return
    }

    setItems((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              qty,
            }
          : p,
      ),
    )
  }

  const setPrice = (id: string, price: number) => {
    if (!Number.isFinite(price) || price < 0) {
      return
    }

    setItems((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              price,
            }
          : p,
      ),
    )
  }

  const remove = (id: string) => {
    setItems((prev) => prev.filter((p) => p.id !== id))
  }

  const clear = () => setItems([])

  const subtotal = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + item.price * item.qty,
        0,
      ),
    [items],
  )

  const value = {
    items,
    add,
    inc,
    dec,
    setQty,
    setPrice,
    remove,
    subtotal,
    clear,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useCart = () => {
  const ctx = useContext(Ctx)

  if (!ctx) {
    throw new Error(
      "useCart must be used within CartProvider",
    )
  }

  return ctx
}