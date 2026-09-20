import { tr } from "../i18n";
import { useSaved } from "../context/Saved";
import { Announcements, Newsletter, FooterColumns, LanguageSwitch } from "./V2";
import { useLanguage } from "../context/Language";
import { useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import {
  Search,
  UserRound,
  ShoppingCart,
  Facebook,
  Instagram,
  ArrowRight,
  Menu,
  X,
  ChevronDown,
  Leaf,
  Heart,
  Scale,
} from "lucide-react";
import { useStore } from "../context/Store";

function TreeItem({ label, to, children, onClick }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <li className={expanded ? "expanded" : ""}>
      <Link onClick={onClick} to={to}>
        {label}
        {children && <ChevronDown className="desktop-chevron" size={12} />}
      </Link>
      {children && (
        <>
          <button
            className="submenu-toggle"
            aria-label={"Show subcategories for " + label}
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            <ChevronDown size={16} />
          </button>
          <ul>{children}</ul>
        </>
      )}
    </li>
  );
}
function MenuTree({ items, parent = null, onClick }) {
  return items
    .filter((x) => x.parent_id === parent)
    .map((x) => (
      <TreeItem
        key={x.id}
        label={x.label}
        to={x.destination || x.url || "#"}
        onClick={onClick}
      >
        {items.some((c) => c.parent_id === x.id) ? (
          <MenuTree items={items} parent={x.id} onClick={onClick} />
        ) : null}
      </TreeItem>
    ));
}
function ShopMenu({ categories, label, close }) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useLanguage();
  const descriptions = {
    "indoor-plants": ["Bring nature inside", "الطبيعة داخل منزلك"],
    "outdoor-plants": ["For gardens & balconies", "للحدائق والشرفات"],
    "office-plants": ["Greener workspaces", "مساحات عمل أكثر خضرة"],
    "flowering-plants": ["Color your space", "ألوان تملأ مساحتك"],
    "climbing-hanging-plants": ["Vertical beauty", "جمال يتسلق الجدران"],
    trees: ["Make a bigger impact", "لمسة أكبر من الطبيعة"],
  };
  const order = Object.keys(descriptions);
  const roots = categories
    .filter((c) => c.parent_id === null && c.slug !== "sales")
    .sort(
      (a, b) =>
        (order.indexOf(a.slug) < 0 ? 99 : order.indexOf(a.slug)) -
        (order.indexOf(b.slug) < 0 ? 99 : order.indexOf(b.slug)),
    );
  const dismiss = () => {
    setExpanded(false);
    close();
  };
  return (
    <li
      className="shop-menu"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setExpanded(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setExpanded(false);
          e.currentTarget.querySelector("button").focus();
        }
      }}
    >
      <div className={"shop-menu-trigger " + (expanded ? "is-open" : "")}>
        <Link to="/shop" onClick={dismiss}>
          {label}
        </Link>
        <button
          type="button"
          aria-label={t("Browse plant categories", "تصفح فئات النباتات")}
          aria-expanded={expanded}
          aria-controls="shop-mega-menu"
          onClick={() => setExpanded(!expanded)}
        >
          <ChevronDown size={17} />
        </button>
      </div>
      <div id="shop-mega-menu" className="shop-mega-menu" hidden={!expanded}>
        <div className="shop-category-grid">
          {roots.map((c) => (
            <Link
              className="shop-category-card"
              key={c.id}
              to={"/shop?category=" + c.slug}
              onClick={dismiss}
            >
              <span className="shop-category-image">
                {c.image ? <img src={c.image} alt="" /> : <Leaf size={32} />}
              </span>
              <span>
                <strong>{c.name}</strong>
                {descriptions[c.slug] && (
                  <small>{t(...descriptions[c.slug])}</small>
                )}
              </span>
            </Link>
          ))}
        </div>
        <Link className="shop-view-all" to="/shop" onClick={dismiss}>
          {t("View All Plants", "عرض جميع النباتات")}
          <ArrowRight size={20} />
        </Link>
      </div>
    </li>
  );
}
export default function Layout() {
  const { wishlist, compare } = useSaved();
  const { t } = useLanguage();
  const { settings, categories, navigation, items, user } = useStore();
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState("");
  const navigate = useNavigate();
  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const headerItems = navigation.filter((x) => x.location === "header");
  const close = () => setOpen(false);
  return (
    <>
      <a className="skip-link" href="#main">
        {tr("Skip to content")}
      </a>
      {settings.store_notice && (
        <div className="notice">{settings.store_notice}</div>
      )}
      <Announcements />
      <header className="store-header">
        <div className="header-top">
          <div className="header-main container">
            <Link className="brand" to="/" aria-label={tr("GHARSA home")}>
              {settings.logo ? (
                <img src={settings.logo} alt={settings.store_name} />
              ) : (
                <>
                  <Leaf />
                  {tr("GHARSA")}
                </>
              )}
            </Link>
            <form
              className="header-search"
              onSubmit={(e) => {
                e.preventDefault();
                navigate("/search?search=" + encodeURIComponent(search));
              }}
            >
              <Search
                className="search-leading-icon"
                size={23}
                aria-hidden="true"
              />
              <input
                aria-label={tr("Search products")}
                placeholder={tr("Search for your perfect plant…")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button aria-label={tr("Search")}>{tr("Search")}</button>
            </form>
            <div className="header-actions">
              <LanguageSwitch />
              <Link
                to="/wishlist"
                className="saved-link"
                aria-label={tr("Wishlist")}
              >
                <Heart size={31} />
                {wishlist.length > 0 && (
                  <span className="header-count-badge">
                    {wishlist.length > 99 ? "99+" : wishlist.length}
                  </span>
                )}
              </Link>
              {compare.length > 0 && (
                <Link to="/compare" aria-label={tr("Compare plants")}>
                  <Scale size={21} />
                  <b>{compare.length}</b>
                </Link>
              )}
              <Link
                to={user ? "/account" : "/login"}
                aria-label={tr("My account")}
              >
                <UserRound size={30} />
              </Link>
              <Link
                className="cart-link"
                to="/cart"
                aria-label={t(`Cart (${cartCount})`, `السلة (${cartCount})`)}
              >
                <span className="cart-icon">
                  <ShoppingCart size={36} />
                  {cartCount > 0 && (
                    <span className="header-count-badge">
                      {cartCount > 99 ? "99+" : cartCount}
                    </span>
                  )}
                </span>
              </Link>
              <button
                className="mobile-toggle"
                aria-label={tr("Toggle navigation")}
                aria-expanded={open}
                aria-controls="store-navigation"
                onClick={() => setOpen(!open)}
              >
                {open ? <X /> : <Menu />}
              </button>
            </div>
          </div>
        </div>
        <nav
          id="store-navigation"
          className={"main-nav reference-nav " + (open ? "open" : "")}
          aria-label={tr("Main navigation")}
        >
          <ul>
            {headerItems
              .filter((x) => x.parent_id === null)
              .map((x) =>
                (x.destination || x.url) === "/shop" ? (
                  <ShopMenu
                    key={x.id}
                    categories={categories}
                    label={x.label}
                    close={close}
                  />
                ) : (
                  <TreeItem
                    key={x.id}
                    label={x.label}
                    to={x.destination || x.url || "#"}
                    onClick={close}
                  >
                    {headerItems.some((c) => c.parent_id === x.id) ? (
                      <MenuTree
                        items={headerItems}
                        parent={x.id}
                        onClick={close}
                      />
                    ) : null}
                  </TreeItem>
                ),
              )}
            <li className="plant-guide-link">
              <Link to="/faq" onClick={close}>
                {t("Plant Guide", "دليل النباتات")}
                <Leaf size={19} />
              </Link>
            </li>
            <li className="sale-nav-link">
              <Link to="/shop?sale=true" onClick={close}>
                {t("SALE", "تخفيضات")}
              </Link>
            </li>
          </ul>
        </nav>
      </header>
      <main id="main">
        <Outlet />
      </main>
      <div
        className="container newsletter-above-footer"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(17,42,27,.12), rgba(17,42,27,.04)), url("${settings.footer_newsletter_image || "/images/footer-bg.webp"}")`,
        }}
      >
        <Newsletter
          title={settings.footer_newsletter_title}
          description={settings.footer_newsletter_text}
        />
      </div>
      <footer className="store-footer">
        <div className="container footer-content">
          <div className="footer-brand-block">
            <Link className="brand" to="/" aria-label={tr("GHARSA home")}>
              {settings.footer_logo || settings.logo ? (
                <img
                  src={settings.footer_logo || settings.logo}
                  alt={settings.store_name || "GHARSA"}
                />
              ) : (
                tr("GHARSA")
              )}
            </Link>
            <p>{settings.footer_text}</p>
            <div className="footer-socials">
              {[
                ["Facebook", Facebook, settings.facebook_url],
                ["Instagram", Instagram, settings.instagram_url],
              ].map(([label, Icon, configured]) => {
                const url =
                  configured ??
                  settings.social_links?.find(
                    (link) => link.label.toLowerCase() === label.toLowerCase(),
                  )?.url;
                return url ? (
                  <a
                    key={label}
                    href={url}
                    aria-label={label}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon size={20} />
                  </a>
                ) : (
                  <span key={label} role="img" aria-label={label}>
                    <Icon size={20} />
                  </span>
                );
              })}
              {settings.social_links
                ?.filter(
                  (link) =>
                    !["facebook", "instagram"].includes(
                      link.label.toLowerCase(),
                    ),
                )
                .map((link) => (
                  <a
                    key={link.label}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {link.label}
                  </a>
                ))}
            </div>
          </div>
          <FooterColumns />
          <div className="footer-contact">
            <h3>{settings.footer_contact_title || tr("Let’s connect")}</h3>
            {settings.phone && (
              <a href={"tel:" + settings.phone}>{settings.phone}</a>
            )}
            {settings.email && (
              <a href={"mailto:" + settings.email}>{settings.email}</a>
            )}
            {settings.address && <p>{settings.address}</p>}
          </div>
        </div>
        <div className="container footer-bottom">
          <span>{settings.copyright}</span>
          <Link to="/admin">{tr("Store administration")}</Link>
        </div>
      </footer>
    </>
  );
}
