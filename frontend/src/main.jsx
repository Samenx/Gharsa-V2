import {SavedProvider} from "./context/Saved";
import {Wishlist,Compare} from "./pages/Saved";
import React, {lazy,Suspense} from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { StoreProvider } from "./context/Store";
import {LanguageProvider} from "./context/Language";
import {FAQPage,PolicyPage} from "./components/V2";
import Layout from "./components/Layout";
import { ContentPage, Shop, Product } from "./pages/StorePages";
import { Cart, Checkout } from "./pages/Checkout";
import Account, { Auth } from "./pages/Account";
const adminPage=name=>lazy(()=>import('./pages/admin/Admin').then(m=>({default:m[name]})));
const operation=name=>lazy(()=>import('./pages/admin/Operations').then(m=>({default:m[name]})));
const AdminLayout=adminPage('AdminLayout'),Dashboard=adminPage('Dashboard'),ResourcePage=adminPage('ResourcePage'),Settings=adminPage('Settings'),AuditLogs=adminPage('AuditLogs');
const Inventory=operation('Inventory'),AdminOrders=operation('AdminOrders'),MediaLibrary=operation('MediaLibrary'),SEOEditor=operation('SEOEditor');
const PageBuilder=lazy(()=>import('./pages/admin/PageBuilder'));
import { ErrorState } from "./components/UI";
import "./styles/main.css";
const V2Operations=lazy(()=>import("./pages/admin/V2Operations"));
class ErrorBoundary extends React.Component {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <ErrorState message="Something went wrong. Please reload the page and try again." />
    ) : (
      this.props.children
    );
  }
}
function ScrollToTop() {
  const { pathname } = useLocation();
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <LanguageProvider><StoreProvider><SavedProvider>
          <ScrollToTop />
          <Suspense fallback={<div className="state" role="status">Loading…</div>}><Routes>
            <Route element={<Layout />}>
              <Route index element={<ContentPage slug="home" />} />
              <Route path="wishlist" element={<Wishlist/>}/><Route path="compare" element={<Compare/>}/><Route path="faq" element={<FAQPage/>}/><Route path="returns" element={<PolicyPage type="returns"/>}/><Route path="guarantee" element={<PolicyPage type="guarantee"/>}/><Route path="delivery" element={<PolicyPage type="delivery"/>}/>
              <Route path="shop" element={<Shop />} />
              <Route path="search" element={<Shop />} />
              <Route path="product/:slug" element={<Product />} />
              <Route path="cart" element={<Cart />} />
              <Route path="checkout" element={<Checkout />} />
              <Route path="login" element={<Auth />} />
              <Route path="register" element={<Auth register />} />
              <Route path="account" element={<Account />} />
              <Route path="account/:tab" element={<Account />} />
              <Route path="account/:tab/:id" element={<Account />} />
              <Route path=":slug" element={<ContentPage />} />
              <Route
                path="*"
                element={<ErrorState message="404 — Page not found" />}
              />
            </Route>
            <Route path="admin" element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              {["return_requests","guarantee_claims","newsletter_subscribers","stock_notifications"].map(type=><Route key={type} path={type} element={<V2Operations type={type}/>}/> )}
              <Route path="inventory" element={<Inventory />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="media" element={<MediaLibrary />} />
              <Route path="seo" element={<SEOEditor />} />
              <Route path="page-builder" element={<PageBuilder />} />
              <Route path="homepage" element={<PageBuilder home />} />
              <Route path="settings" element={<Settings />} />
              <Route path="audit-logs" element={<AuditLogs />} />
              <Route
                path="customers"
                element={<ResourcePage resource="users" customers />}
              />
              <Route path=":resource" element={<ResourcePage />} />
            </Route>
          </Routes></Suspense>
        </SavedProvider></StoreProvider></LanguageProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
createRoot(document.getElementById("root")).render(<App />);
