"use client"

// F2b: CartProvider was a client-only gate that returned `null` on the server,
// which blanked the ENTIRE SSR <body> for every route (the platform shipped
// empty shells that only rendered after JS hydrated). The cart itself lives in
// the Zustand store (@/store/cart-store) consumed via useCartStore, so this
// provider never supplied any context — it was a pure passthrough whose only
// effect was hiding all server-rendered content. Rendering children always
// makes the whole platform server-render correctly. Any window.* reads that
// were previously masked by the blank body are fixed at their source.
export function CartProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
