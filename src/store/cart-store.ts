import { create, type StateCreator } from "zustand"
import { persist, type PersistOptions } from "zustand/middleware"
import { toast } from "sonner"

export interface CartItem {
  productId: string
  name: string
  image: string | null
  quantity: number
  price: number
  /** P1 #37 (re-audit 2026-11): zaloga ob dodajanju v košarico — omogoča
   * max omejitev količine v UI (vnos po tipkovnici + client-side omejitev).
   * null/undefined = zaloga ni znana (starejši shranjeni vozički). */
  stockQuantity?: number | null
}

/**
 * Multi-tenant cart (per-salon isolation).
 *
 * `cartsByOrg` holds one cart per organization slug and is the ONLY
 * persisted slice — switching salon therefore switches basket, and two
 * salons can never see each other's products.
 *
 * `items` is a transient runtime mirror of the ACTIVE org's cart so every
 * existing consumer keeps the exact same API as before (`items`,
 * `addItem`, `getTotalItems`, …). `setActiveOrg` is called once per page
 * by <CartOrgScope /> mounted in the (public)/(customer) layouts.
 */
interface CartState {
  items: CartItem[]
  cartsByOrg: Record<string, CartItem[]>
  activeOrg: string
  setActiveOrg: (slug: string | null) => void
  addItem: (product: Omit<CartItem, "quantity">) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
  getTotalItems: () => number
  getTotalPrice: () => number
  deleteItem: (productId: string) => void
}

type CartPersistedState = { cartsByOrg: Record<string, CartItem[]> }

type CartPersist = (
  config: StateCreator<CartState>,
  options: PersistOptions<CartState, CartPersistedState>
) => StateCreator<CartState>

/** Bare routes (platform root) share the fallback cart of the default org. */
const ORG_FALLBACK = ""

const orgItems = (state: {
  cartsByOrg: Record<string, CartItem[]>
  activeOrg: string
}): CartItem[] => state.cartsByOrg[state.activeOrg] ?? []

export const useCartStore = create<CartState>(
  (persist as CartPersist)(
    (set, get) => ({
      items: [],
      cartsByOrg: {},
      activeOrg: ORG_FALLBACK,

      setActiveOrg: (slug) => {
        const activeOrg = slug ?? ORG_FALLBACK
        set({ activeOrg, items: get().cartsByOrg[activeOrg] ?? [] })
      },

      addItem: (product) => {
        const state = get()
        const items = orgItems(state)
        const existingItem = items.find(
          (item) => item.productId === product.productId
        )

        // P1 #37: spoštuj zalogo — če je izčrpana, ne povečuj količine.
        const maxStock = product.stockQuantity ?? null
        if (
          existingItem &&
          maxStock !== null &&
          maxStock !== undefined &&
          existingItem.quantity + 1 > maxStock
        ) {
          toast.error(
            `Na zalogi je le še ${maxStock} kos izdelka ${product.name}.`
          )
          return
        }

        const nextItems = existingItem
          ? items.map((item) =>
              item.productId === product.productId
                ? { ...item, quantity: item.quantity + 1 }
                : item
            )
          : [...items, { ...product, quantity: 1 }]

        set({
          cartsByOrg: { ...state.cartsByOrg, [state.activeOrg]: nextItems },
          items: nextItems,
        })

        if (existingItem) {
          toast.success(
            `Količina izdelka ${product.name} v košarici je povečana.`
          )
        } else {
          toast.success(`${product.name} je bil dodan v košarico.`)
        }
      },

      removeItem: (productId) => {
        const state = get()
        const nextItems = orgItems(state).filter(
          (item) => item.productId !== productId
        )
        set({
          cartsByOrg: { ...state.cartsByOrg, [state.activeOrg]: nextItems },
          items: nextItems,
        })
      },

      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId)
          return
        }
        const state = get()
        const nextItems = orgItems(state).map((item) =>
          item.productId === productId ? { ...item, quantity } : item
        )
        set({
          cartsByOrg: { ...state.cartsByOrg, [state.activeOrg]: nextItems },
          items: nextItems,
        })
      },

      clearCart: () => {
        const state = get()
        set({
          cartsByOrg: { ...state.cartsByOrg, [state.activeOrg]: [] },
          items: [],
        })
      },

      getTotalItems: () => {
        return orgItems(get()).reduce((total, item) => total + item.quantity, 0)
      },

      getTotalPrice: () => {
        return orgItems(get()).reduce(
          (total, item) => total + item.price * item.quantity,
          0
        )
      },

      // Alias kept for API compatibility — previously a duplicate of removeItem.
      deleteItem: (productId) => {
        get().removeItem(productId)
      },
    }),
    {
      name: "cart-storage",
      version: 1,
      // Persist ONLY the per-org carts — items/activeOrg are runtime mirrors.
      partialize: (state) => ({ cartsByOrg: state.cartsByOrg }),
      migrate: (persisted) => {
        const old = persisted as
          | (Partial<CartState> & { items?: CartItem[] })
          | null
        // v0 stored one flat, cross-tenant cart — its items could MIX
        // products from different salons, so they are intentionally
        // DISCARDED (never surfaced under any org).
        return { cartsByOrg: old?.cartsByOrg ?? {} }
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return
        // Early builds of the per-org store parked legacy flat-cart items
        // under the "" key — unreachable in the UI (bare routes bind to the
        // default org's slug). Purge it so storage stays clean.
        if (state.cartsByOrg[""]) {
          const rest = { ...state.cartsByOrg }
          delete rest[""]
          useCartStore.setState({
            cartsByOrg: rest,
            items: rest[state.activeOrg] ?? [],
          })
          return
        }
        useCartStore.setState({
          items: state.cartsByOrg[state.activeOrg] ?? [],
        })
      },
    }
  )
)
