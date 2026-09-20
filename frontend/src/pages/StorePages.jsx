import {tr} from "../i18n";
import Bundle from "../components/Bundle";
import {ProductExtras,ProductCare,DeliveryEstimate,StockInterest} from "../components/V2";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useStore } from "../context/Store";
import {
  useData,
  Loading,
  ErrorState,
  SEO,
  Breadcrumb,
  Stars,
  Field,
  Modal,
} from "../components/UI";
import Section from "../components/Sections";
import { ProductGrid } from "../components/Products";
import { api, money, effectivePrice } from "../api/client";
export function ContentPage({ slug: fixed }) {
  const { slug } = useParams();
  const { data, error, loading } = useData("/pages/" + (fixed || slug));
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;
  return (
    <>
      <SEO data={data} />
      {data.slug === "home" && (
        <h1 className="sr-only">{data.title}{tr("— GHARSA plant store")}</h1>
      )}
      {data.slug !== "home" && (
        <div className="page-title">
          <h1>{data.title}</h1>
        </div>
      )}
      {data.sections.map((s) => (
        <Section key={s.id} section={s} />
      ))}
    </>
  );
}
export function Shop() {
  const [params, setParams] = useSearchParams();
  const { categories } = useStore();
  const { data, error, loading } = useData("/products?" + params.toString());
  const selected = categories.find((c) => c.slug === params.get("category"));
  const update = (k, v) => {
    const next = new URLSearchParams(params);
    v ? next.set(k, v) : next.delete(k);
    if (k !== "page") next.delete("page");
    setParams(next);
  };
  return (
    <div className="container shop-page">
      <SEO
        data={
          selected || {
            title: params.get("search") ? "Search results" : tr("Shop"),
          }
        }
      />
      <Breadcrumb items={[{ label: tr("Shop") }]} />
      <div className="shop-layout">
        <aside className="shop-filters">
          <h3>{tr("Find your plant")}</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              update("search", new FormData(e.currentTarget).get("search"));
            }}
          >
            <Field
              label={tr("Search")}
              name="search"
              defaultValue={params.get("search") || ""}
            />
            <button className="button small">{tr("Search")}</button>
          </form>
          <h3>{tr("Categories")}</h3>
          <Link to="/shop" className={!selected ? "selected" : ""}>{tr("All plants")}</Link>
          {categories
            .filter((c) => !c.parent_id)
            .map((c) => (
              <div key={c.id}>
                <button
                  className={
                    "filter-link " + (selected?.id === c.id ? "selected" : "")
                  }
                  onClick={() =>
                    update(
                      c.slug === "sales" ? "sale" : "category",
                      c.slug === "sales" ? "true" : c.slug,
                    )
                  }
                >
                  {c.name}
                </button>
                {(selected?.id === c.id || selected?.parent_id === c.id) &&
                  categories
                    .filter((s) => s.parent_id === c.id)
                    .map((s) => (
                      <button
                        key={s.id}
                        className={
                          "filter-link sub " +
                          (selected?.id === s.id ? "selected" : "")
                        }
                        onClick={() => update("category", s.slug)}
                      >
                        {s.name}
                      </button>
                    ))}
              </div>
            ))}
          <h3>{tr("Find your fit")}</h3>
          <ExtraFilters params={params} update={update}/>
          <h3>{tr("Price range · JOD")}</h3>
          <div className="price-filter">
            <input
              type="number"
              min="0"
              aria-label={tr("Minimum price")}
              placeholder={tr("Min")}
              value={params.get("min") || ""}
              onChange={(e) => update("min", e.target.value)}
            />
            <input
              type="number"
              min="0"
              aria-label={tr("Maximum price")}
              placeholder={tr("Max")}
              value={params.get("max") || ""}
              onChange={(e) => update("max", e.target.value)}
            />
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={params.get("sale") === "true"}
              onChange={(e) => update("sale", e.target.checked ? "true" : "")}
            />{" "}{tr("On sale")}</label>
          <button className="text-button" onClick={() => setParams({})}>{tr("Clear filters")}</button>
        </aside>
        <section>
          <h1>
            {selected?.name ||
              (params.get("search")
                ? `Results for “${params.get("search")}”`
                : tr("Shop"))}
          </h1>
          <div className="shop-toolbar">
            <span className="muted">
              {data ? `${data.total} products` : tr("Finding plants…")}
            </span>
            <select
              aria-label={tr("Sort products")}
              value={params.get("sort") || ""}
              onChange={(e) => update("sort", e.target.value)}
            >
              <option value="">{tr("Default sorting")}</option>
              <option value="newest">{tr("Latest")}</option>
              <option value="popularity">{tr("Most popular")}</option>
              <option value="price_asc">{tr("Price: low to high")}</option>
              <option value="price_desc">{tr("Price: high to low")}</option>
              <option value="name">{tr("Name")}</option>
              <option value="rating">{tr("Top rated")}</option>
            </select>
          </div>
          {loading ? (
            <Loading />
          ) : error ? (
            <ErrorState message={error} />
          ) : (
            <>
              <ProductGrid products={data.items} config={{ columns: 3 }} />
              <nav className="pagination" aria-label={tr("Product pages")}>
                {Array.from({ length: data.pages }, (_, i) => i + 1).map(
                  (n) => (
                    <button
                      key={n}
                      aria-current={data.page === n ? "page" : undefined}
                      className={data.page === n ? "active" : ""}
                      onClick={() => update("page", n)}
                    >
                      {n}
                    </button>
                  ),
                )}
              </nav>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
export function Product() {
  const { slug } = useParams();
  const { data: p, error, loading } = useData("/products/" + slug);
  const { addToCart, user, notify } = useStore();
  const [quantity, setQuantity] = useState(1),
    [selected, setSelected] = useState(null),
    [variationId,setVariationId]=useState(null),
    [zoom, setZoom] = useState(false),
    [busy, setBusy] = useState(false);
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;
  const variation=p.variations?.find(v=>v.id===variationId)||p.variations?.[0];
  const buying=variation?{...p,...variation,id:p.id,on_sale:variation.sale_price!==null,stock_status:variation.stock_quantity>0?'in_stock':'out_of_stock'}:p;
  const img = selected?.slug === slug ? selected.path : variation?.image || p.main_image;
  return (
    <div className="container product-page">
      <SEO data={p} />
      <Breadcrumb
        items={[
          { label: tr("Shop"), to: "/shop" },
          { label: p.category_name, to: "/shop?category=" + p.category_slug },
          { label: p.name },
        ]}
      />
      <div className="product-detail">
        <div>
          <button
            className="zoom-image"
            onClick={() => setZoom(true)}
            aria-label={tr("Zoom product image")}
          >
            <img src={img} alt={p.name} />
          </button>
          <div className="thumbnails">
            {[{ path: p.main_image }, ...p.images].map((i, n) => (
              <button
                key={n}
                onClick={() => setSelected({ slug, path: i.path })}
              >
                <img src={i.path} alt={i.alt || p.name} />
              </button>
            ))}
          </div>
        </div>
        <div className="product-summary">
          <Link className="eyebrow" to={"/shop?category=" + p.category_slug}>
            {p.category_name}
          </Link>
          <h1>{p.name}</h1>
          <Stars rating={p.average_rating} />{" "}
          <a href="#reviews">({p.review_count}{tr("customer reviews)")}</a>
          <div className="price large">
            {buying.on_sale && buying.sale_price !== null && (
              <del>{money(buying.regular_price)}</del>
            )}
            {money(effectivePrice(buying))}
            {buying.on_sale &&
              Number(buying.regular_price) > 0 &&
              buying.sale_price !== null && (
                <span className="discount">{tr("Save")}{" "}{Math.round((1 - buying.sale_price / buying.regular_price) * 100)}%
                </span>
              )}
          </div>
          <p>{p.short_description}</p>
          <ProductCare product={p}/>
          {p.variations?.length>0&&<fieldset className="size-selector"><legend>{tr("Choose your size")}</legend>{p.variations.map(v=><button type="button" key={v.id} className={variation?.id===v.id?'active':''} onClick={()=>{setVariationId(v.id);setQuantity(1);setSelected(null)}}><strong>{v.name}</strong><small>{[v.height,v.pot_size].filter(Boolean).join(' · ')}</small><span>{money(v.sale_price??v.regular_price)}</span></button>)}</fieldset>}
          <p className="stock">
            {buying.stock_quantity > 0 && buying.stock_status === "in_stock"
              ? `${buying.stock_quantity} in stock`
              : tr("Out of stock")}
          </p>
          <div className="purchase">
            <input
              aria-label={tr("Quantity")}
              type="number"
              min="1"
              max={buying.stock_quantity}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
            />
            <button
              className="button"
              disabled={!buying.stock_quantity || buying.stock_status === "out_of_stock"}
              onClick={() => addToCart(p, quantity,variation)}
            >{tr("Add to cart")}</button>
          </div>
          <DeliveryEstimate/>
          <p className="policy-links"><Link to="/returns">{tr("Returns")}</Link> · <Link to="/guarantee">{tr("Plant guarantee")}</Link></p>
          {p.guarantees?.[0]&&<div className="guarantee-note"><strong>{p.guarantees[0].title}</strong><p>{p.guarantees[0].conditions}</p></div>}
          {(!buying.stock_quantity || buying.stock_status === "out_of_stock") && <StockInterest productId={p.id} variationId={variation?.id||null}/>}
          <div className="product-meta">
            <p>{tr("SKU:")}{" "}{buying.sku}</p>
            <p>{tr("Category:")}{" "}{p.category_name}</p>
            <p>{tr("Carefully packed. Delivered to your doorstep.")}</p>
          </div>
        </div>
      </div>
      <section className="product-description">
        <h2>{tr("Description")}</h2>
        {String(p.description || "").replace(/<\/?p[^>]*>/gi, "\n").replace(/<br\s*\/?\s*>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").split(/\n+/).map((paragraph, index) => paragraph.trim() && <p key={index}>{paragraph.trim()}</p>)}
      </section>
      {p.bundles?.map(b=><Bundle key={b.id} bundle={b} product={p} variation={variation}/>)}
      <ProductExtras product={p}/>
      <section id="reviews" className="reviews">
        <h2>{tr("Reviews (")}{" "}{p.review_count})</h2>
        {p.reviews.map((r) => (
          <article key={r.id}>
            <Stars rating={r.rating} />
            <h3>{r.title}</h3>
            <p>{r.body}</p>
            <small>
              {r.name} · {new Date(r.created_at).toLocaleDateString()}
            </small>
          </article>
        ))}
        {!p.reviews.length && (
          <p className="muted">{tr("Be the first to share your experience.")}</p>
        )}
        {user ? (
          <form
            className="review-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              setBusy(true);
              try {
                const data = Object.fromEntries(new FormData(form));
                await api("/reviews", {
                  method: "POST",
                  body: { ...data, product_id: p.id },
                });
                notify("Your review has been submitted for approval.");
                form.reset();
              } catch (e) {
                notify(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <h3>{tr("Write a review")}</h3>
            <label className="field">{tr("Rating")}<select name="rating">
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n}{tr("stars")}</option>
                ))}
              </select>
            </label>
            <Field label={tr("Title")} name="title" required />
            <Field
              label={tr("Your review")}
              name="body"
              as="textarea"
              minLength={5}
              required
            />
            <button className="button" disabled={busy}>{tr("Submit review")}</button>
          </form>
        ) : (
          <p>
            <Link to="/login">{tr("Sign in")}</Link>{tr("to leave a review.")}</p>
        )}
      </section>
      {p.related.length > 0 && (
        <section className="section">
          <h2>{tr("Related products")}</h2>
          <ProductGrid products={p.related} />
        </section>
      )}
      {p.recommended.length > 0 && (
        <section className="section">
          <h2>{tr("You may also like")}</h2>
          <ProductGrid products={p.recommended.filter((x) => x.id !== p.id)} />
        </section>
      )}
      {zoom && (
        <Modal title={p.name} onClose={() => setZoom(false)}>
          <img className="zoomed" src={img} alt={p.name} />
        </Modal>
      )}
    </div>
  );
}

function ExtraFilters({params,update}) {
 const {data}=useData('/v2/site');
 return <div className="extra-filters"><label>{tr("Availability")}<select value={params.get('stock')||''} onChange={e=>update('stock',e.target.value)}><option value="">{tr("All stock")}</option><option value="in_stock">{tr("In stock")}</option><option value="out_of_stock">{tr("Out of stock")}</option></select></label><label>{tr("Suitable location")}<select value={params.get('location')||''} onChange={e=>update('location',e.target.value)}><option value="">{tr("All locations")}</option>{data?.locations.map(l=><option key={l.id} value={l.slug}>{l.name}</option>)}</select></label>{[['light',tr("Light")],['watering',tr("Watering")],['difficulty',tr("Care difficulty")],['size',tr("Plant size")]].map(([key,label])=><label key={key}>{label}<input value={params.get(key)||''} placeholder={'Filter by '+label.toLowerCase()} onChange={e=>update(key,e.target.value)}/></label>)}</div>

}
