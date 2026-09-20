import { useLocation } from "react-router-dom";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { api,lineKey } from "../api/client";
const Context = createContext();
function guestCart() {
  try {
    return JSON.parse(localStorage.getItem("gharsa_cart") || "[]").filter(
      (x) => Number.isInteger(x.product_id) && x.quantity > 0,
    );
  } catch {
    return [];
  }
}
export function StoreProvider({ children }) {
  const { pathname } = useLocation();
  const [user, setUser] = useState(null),
    [ready, setReady] = useState(false),
    [items, setItems] = useState(guestCart),
    [settings, setSettings] = useState({}),
    [categories, setCategories] = useState([]),
    [navigation, setNavigation] = useState([]),
    [toast, setToast] = useState(""),
    [cartProducts, setCartProducts] = useState([]);
  const timer = useRef(),
    cartQueue = useRef(Promise.resolve());
  const notify = (m) => {
    setToast(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), 4500);
  };
  const refreshSite = () =>
    Promise.all([
      api("/settings").then(setSettings),
      api("/categories").then(setCategories),
      api("/navigation").then(setNavigation),
    ]);
  useEffect(() => {
    refreshSite().catch((e) => notify(e.message));
    (async () => {
      try {
        if (sessionStorage.getItem("gharsa_token")) {
          setUser(await api("/auth/me"));
          setItems(await api("/cart"));
        }
      } catch {
        sessionStorage.removeItem("gharsa_token");
      } finally {
        setReady(true);
      }
    })();
  }, []);
  useEffect(() => {
    if (!items.length) {
      setCartProducts([]);
      return;
    }
    api(
      "/products?ids=" +
        items.map((i) => i.product_id).join(",") +
        "&limit=100",
    )
      .then((r) => setCartProducts(r.items))
      .catch((e) => notify(e.message));
  }, [items]);
  useEffect(() => {
    if (settings.favicon) {
      let icon = document.querySelector('link[rel="icon"]');
      if (!icon) {
        icon = document.createElement("link");
        icon.rel = "icon";
        document.head.appendChild(icon);
      }
      icon.href = settings.favicon;
    }
  }, [settings.favicon]);
  useEffect(() => {
    if (!ready) return;
    let live = true;
    const sync = async () => {
      if (!sessionStorage.getItem("gharsa_token")) return;
      try {
        const current = await api("/auth/me");
        if (live) setUser(current);
      } catch (e) {
        if (e.status === 401 && live) {
          sessionStorage.removeItem("gharsa_token");
          setUser(null);
          setItems(guestCart());
        }
      }
    };
    sync();
    window.addEventListener("focus", sync);
    return () => {
      live = false;
      window.removeEventListener("focus", sync);
    };
  }, [pathname, ready]);
  const saveCart = (next) => {
    setItems(next);
    if (user) {
      cartQueue.current = cartQueue.current
        .catch(() => {})
        .then(() => api("/cart", { method: "PUT", body: { items: next } }))
        .catch((e) => notify("Cart could not be saved: " + e.message));
    } else localStorage.setItem("gharsa_cart", JSON.stringify(next));
  };
  const addToCart = (p, quantity = 1, variation = null, bundleId = null) => {
    const line={product_id:p.id,variation_id:variation?.id||null,bundle_id:bundleId};
    const stock=variation||p;
    const current = items.find((i) => lineKey(i)===lineKey(line))?.quantity || 0;
    if (
      (!variation && p.stock_status === "out_of_stock") ||
      current + quantity > stock.stock_quantity
    ) {
      notify("The requested quantity is not available.");
      return false;
    }
    saveCart([
      ...items.filter((i) => lineKey(i)!==lineKey(line)),
      { ...line, quantity: current + quantity },
    ]);
    notify("Added to cart");
    return true;
  };
  const authenticate = async (path, data) => {
    const result = await api("/auth/" + path, { method: "POST", body: data });
    sessionStorage.setItem("gharsa_token", result.token);
    setUser(result.user);
    const server = await api("/cart");
    const merged = new Map(server.map(i=>[lineKey(i),i]));
    for(const i of guestCart()) {const old=merged.get(lineKey(i));merged.set(lineKey(i),{...i,quantity:Math.min(999,(old?.quantity||0)+i.quantity)});}
    const next=[...merged.values()];
    await api("/cart", { method: "PUT", body: { items: next } });
    setItems(next);
    localStorage.removeItem("gharsa_cart");
    return result.user;
  };
  const logout = async () => {
    await cartQueue.current;
    try {
      await api("/auth/logout", { method: "POST" });
    } finally {
      sessionStorage.removeItem("gharsa_token");
      setUser(null);
      setItems(guestCart());
    }
  };
  const can = (p) =>
    !!user &&
    (user.roles.includes("SUPER_ADMIN") || user.permissions.includes(p));
  return (
    <Context.Provider
      value={{
        user,
        setUser,
        ready,
        items,
        saveCart,
        addToCart,
        settings,
        categories,
        navigation,
        refreshSite,
        notify,
        authenticate,
        logout,
        can,
        cartProducts,
      }}
    >
      {children}
      {toast && (
        <div role="status" className="toast">
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            ×
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
export const useStore = () => useContext(Context);
