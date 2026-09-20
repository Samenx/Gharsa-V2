import {tr} from "../i18n";
import {useSaved} from "../context/Saved";
import { Link, useNavigate } from "react-router-dom";
import { Heart, ShoppingBag, Scale } from "lucide-react";
import { useStore } from "../context/Store";
import { api, money, effectivePrice } from "../api/client";
import { Stars, Empty } from "./UI";
export function ProductCard({ product: p, config = {} }) {
  const { addToCart, user, notify } = useStore();
  const navigate = useNavigate();
  const {wishlist,save,compare,compareProduct}=useSaved();
  return (
    <article className="product-card">
      <div className="product-image">
        <Link to={"/product/" + p.slug}>
          <img loading="lazy" src={p.main_image} alt={p.name} />
        </Link>
        {p.on_sale && p.sale_price !== null && (
          <span className="sale-badge">{tr("Sale!")}</span>
        )}
        <button
          className="favorite"
          aria-label={"Save " + p.name + " to wishlist"}
          aria-pressed={wishlist.includes(p.id)}
          onClick={()=>save(p.id)}
        >
          <Heart size={19} fill={wishlist.includes(p.id)?"currentColor":"none"} />
        </button>
        {config.showAddToCart !== false && (
          <button
            className="quick-add"
            disabled={!p.has_variations && (!p.stock_quantity || p.stock_status === "out_of_stock")}
            onClick={() => p.has_variations ? navigate("/product/"+p.slug) : addToCart(p)}
          >
            <ShoppingBag size={16} />
            {p.has_variations ? tr("Choose size") : p.stock_quantity && p.stock_status !== "out_of_stock"
              ? tr("Add to cart")
              : tr("Out of stock")}
          </button>
        )}
      </div>
      <button className="compare-button" aria-pressed={compare.includes(p.id)} onClick={()=>compareProduct(p.id)}><Scale size={16}/>{compare.includes(p.id)?tr("In comparison"):tr("Compare")}</button>
      <div className="product-info">
        <Link to={"/product/" + p.slug}>
          <h3>{p.name}</h3>
        </Link>
        <Link className="muted" to={"/shop?category=" + p.category_slug}>
          {p.category_name}
        </Link>
        {config.showRating !== false && (
          <div>
            <Stars rating={Number(p.average_rating || 0)} />
          </div>
        )}
        {config.showPrice !== false && (
          <div className="price">
            {p.on_sale && p.sale_price !== null && (
              <del>{money(p.regular_price)}</del>
            )}
            <span>{p.has_variations ? (localStorage.getItem("gharsa_language")==="ar"?"من ":"From "):""}{money(p.variation_from_price??effectivePrice(p))}</span>
          </div>
        )}
      </div>
    </article>
  );
}
export const ProductGrid = ({ products, config }) =>
  products?.length ? (
    <div className="product-grid" style={{ "--columns": config?.columns || 4 }}>
      {products.map((p) => (
        <ProductCard key={p.id} product={p} config={config} />
      ))}
    </div>
  ) : (
    <Empty>{tr("No plants found. Try a different search or category.")}</Empty>
  );
