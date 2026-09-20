import {tr} from "../i18n";
import {DeliveryEstimate} from "../components/V2";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../context/Store";
import { api, money,lineKey } from "../api/client";
import { Field, Empty, SEO } from "../components/UI";
export function Summary({ quote }) {
  return (
    <div className="order-summary">
      <h2>{tr("Order summary")}</h2>
      <div>
        <span>{tr("Subtotal")}</span>
        <strong>{money(quote?.subtotal)}</strong>
      </div>
      {quote?.discount > 0 && (
        <div>
          <span>{tr("Discount")}</span>
          <strong>−{money(quote.discount)}</strong>
        </div>
      )}
      <div>
        <span>{tr("Shipping")}</span>
        <strong>
          {quote?.shipping === 0 ? tr("Free") : money(quote?.shipping)}
        </strong>
      </div>
      {quote?.tax > 0 && (
        <div>
          <span>{tr("Tax")}</span>
          <strong>{money(quote.tax)}</strong>
        </div>
      )}
      <div className="total">
        <span>{tr("Total")}</span>
        <strong>{money(quote?.total)}</strong>
      </div>
    </div>
  );
}
function useQuote(items, coupon, email) {
  const [quote, setQuote] = useState(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    let live = true;
    setError("");
    setQuote(null);
    if (!items.length) return;
    setLoading(true);
    api("/cart/quote", { method: "POST", body: { items, coupon, email } })
      .then((q) => {
        if (live) setQuote(q);
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [JSON.stringify(items), coupon, email]);
  return { quote, error, loading };
}
export function Cart() {
  const { items, saveCart, cartProducts, user } = useStore();
  const [coupon, setCoupon] = useState(
    sessionStorage.getItem("gharsa_coupon") || "",
  );
  const { quote, error, loading } = useQuote(items, coupon, user?.email);
  const apply = (value) => {
    setCoupon(value);
    sessionStorage.setItem("gharsa_coupon", value);
  };
  if (!items.length)
    return (
      <Empty>
        <h1>{tr("Your cart is empty")}</h1>
        <p>{tr("Find a little green for your space.")}</p>
        <Link className="button" to="/shop">{tr("Continue shopping")}</Link>
      </Empty>
    );
  return (
    <div className="container section">
      <SEO data={{ title: tr("Shopping cart") }} />
      <h1>{tr("Shopping cart")}</h1>
      <div className="cart-layout">
        <div>
          <div className="cart-items">
            {items.map((i) => {
              const p = cartProducts.find((x) => x.id === i.product_id);
              const quoted=quote?.items.find(x=>lineKey(x)===lineKey(i));
              return (
                <article className="cart-item" key={lineKey(i)}>
                  {p?.main_image && <img src={p.main_image} alt={p.name} />}
                  <div>
                    <Link to={"/product/" + p?.slug}>
                      <h3>{p?.name || "Unavailable product"}</h3>
                      {quoted?.variation_name&&<small>{quoted.variation_name}</small>}
                      {i.bundle_id&&<small>{tr("· Bundle")}</small>}
                    </Link>
                    <button
                      className="text-button"
                      onClick={() =>
                        saveCart(
                          items.filter((x) => lineKey(x) !== lineKey(i)),
                        )
                      }
                    >{tr("Remove")}</button>
                  </div>
                  <input
                    type="number"
                    min="1"
                    max={quoted?.stock_quantity || 999}
                    aria-label={"Quantity for " + p?.name}
                    value={i.quantity}
                    onChange={(e) =>
                      saveCart(
                        items.map((x) =>
                          lineKey(x) === lineKey(i)
                            ? {
                                ...x,
                                quantity: Math.max(
                                  1,
                                  Math.min(999, Number(e.target.value)),
                                ),
                              }
                            : x,
                        ),
                      )
                    }
                  />
                  <strong>
                    {money(
                      (quote?.items.find((x) => lineKey(x) === lineKey(i))
                        ?.unit_price || 0) * i.quantity,
                    )}
                  </strong>
                </article>
              );
            })}
          </div>
          <form
            className="coupon-form"
            onSubmit={(e) => {
              e.preventDefault();
              apply(new FormData(e.currentTarget).get("coupon"));
            }}
          >
            <input
              name="coupon"
              aria-label={tr("Coupon code")}
              placeholder={tr("Coupon code")}
              defaultValue={coupon}
            />
            <button className="button outline">{tr("Apply coupon")}</button>
          </form>
          {coupon && (
            <p>{tr("Coupon:")}{" "}{coupon}{" "}
              <button className="text-button" onClick={() => apply("")}>{tr("Remove coupon")}</button>
            </p>
          )}
          <Link to="/shop">{tr("← Continue shopping")}</Link>
        </div>
        <aside>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <Summary quote={quote} />
          <DeliveryEstimate/>
          <p className="policy-links"><Link to="/returns">{tr("Returns")}</Link> · <Link to="/guarantee">{tr("Plant guarantee")}</Link></p>
          {quote && !loading && (
            <Link className="button full" to="/checkout">{tr("Proceed to checkout")}</Link>
          )}
          {loading && <p>{tr("Updating totals…")}</p>}
        </aside>
      </div>
    </div>
  );
}
export function Checkout() {
  const { items, saveCart, user, settings } = useStore();
  const [coupon] = useState(sessionStorage.getItem("gharsa_coupon") || "");
  const [city,setCity]=useState('');
  const [email, setEmail] = useState(user?.email || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [order, setOrder] = useState(null),
    [addresses, setAddresses] = useState([]);
  const key = useRef(crypto.randomUUID());
  const formRef = useRef();
  const { quote, error: quoteError, loading } = useQuote(items, coupon, email);
  useEffect(() => {
    if (user)
      api("/auth/addresses")
        .then(setAddresses)
        .catch(() => {});
  }, [user]);
  if (order)
    return (
      <div className="container section order-success">
        <span className="success-icon">✓</span>
        <h1>{tr("Thank you for your order.")}</h1>
        <p>{tr("Your plants will soon be on their way.")}</p>
        <p>{tr("Order")}<strong>{order.order_number}</strong>
        </p>
        <p>{tr("Cash on delivery ·")}{" "}{money(order.total)}</p>
        {user && (
          <Link className="button" to="/account/orders">{tr("View your orders")}</Link>
        )}
        <Link to="/shop">{tr("Continue shopping")}</Link>
      </div>
    );
  if (!items.length)
    return (
      <Empty>{tr("Your cart is empty.")}<Link to="/shop">{tr("Shop plants")}</Link>
      </Empty>
    );
  return (
    <div className="container section">
      <SEO data={{ title: tr("Checkout"), noindex: true }} />
      <h1>{tr("Checkout")}</h1>
      {!user && (
        <p>{tr("Already have an account?")}<Link to="/login">{tr("Sign in")}</Link>{tr("to save this order to your account.")}</p>
      )}
      <form
        ref={formRef}
        className="checkout-layout"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          const data = Object.fromEntries(new FormData(e.currentTarget));
          try {
            const result = await api("/checkout", {
              method: "POST",
              body: {
                items,
                coupon,
                email,
                shipping_address: {
                  first_name: data.first_name,
                  last_name: data.last_name,
                  phone: data.phone,
                  address: data.address,
                  city: data.city,
                  additional_address: data.additional_address,
                  country: "Jordan",
                },
                notes: data.notes,
                payment_method: "cod",
                idempotency_key: key.current,
              },
            });
            setOrder(result);
            saveCart([]);
            sessionStorage.removeItem("gharsa_coupon");
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <section>
          <h2>{tr("Billing & delivery details")}</h2>
          {addresses.length > 0 && (
            <label className="field">{tr("Use a saved address")}<select
                defaultValue=""
                onChange={(e) => {
                  const a = addresses.find(
                    (x) => x.id === Number(e.target.value),
                  );
                  if(a)setCity(a.city);
                  if (a)
                    for (const [k, v] of Object.entries(a))
                      if (formRef.current.elements[k])
                        formRef.current.elements[k].value = v;
                }}
              >
                <option value="">{tr("Enter a new address")}</option>
                {addresses.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}: {a.address}, {a.city}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="form-grid">
            <Field
              label={tr("First name")}
              name="first_name"
              autoComplete="given-name"
              required
            />
            <Field
              label={tr("Last name")}
              name="last_name"
              autoComplete="family-name"
              required
            />
          </div>
          <Field
            label={tr("Email")}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            readOnly={!!user}
            required
          />
          <Field
            label={tr("Phone")}
            name="phone"
            type="tel"
            defaultValue={user?.phone}
            autoComplete="tel"
            required
          />
          <Field label={tr("Country")} value="Jordan" readOnly />
          <Field
            label={tr("Street address")}
            name="address"
            autoComplete="street-address"
            required
          />
          <Field
            label={tr("City")}
            name="city"
            value={city}
            onChange={e=>setCity(e.target.value)}
            autoComplete="address-level2"
            required
          />
          <Field
            label={tr("Apartment, building, or other address information")}
            name="additional_address"
          />
          <Field label={tr("Order notes")} name="notes" as="textarea" />
        </section>
        <aside>
          <h2>{tr("Your order")}</h2>
          {quote?.items.map((p) => (
            <div className="order-line" key={lineKey(p)}>
              <span>
                {p.name}{p.variation_name ? " · " + p.variation_name : ""} × {p.quantity}
              </span>
              <span>{money(p.unit_price * p.quantity)}</span>
            </div>
          ))}
          <Summary quote={quote} />
          <DeliveryEstimate city={city}/>
          <p className="policy-links"><Link to="/returns">{tr("Returns")}</Link> · <Link to="/guarantee">{tr("Plant guarantee")}</Link></p>
          <div className="payment-method">
            <label>
              <input type="radio" checked readOnly />{tr("Cash on delivery")}</label>
            <p>{tr("Pay when your plants arrive at your doorstep.")}</p>
          </div>
          {(error || quoteError) && (
            <p className="error" role="alert">
              {error || quoteError}
            </p>
          )}
          <button
            className="button full"
            disabled={
              busy || loading || !quote || settings.cod_enabled === false
            }
          >
            {busy ? tr("Placing order…") : tr("Place order")}
          </button>
        </aside>
      </form>
    </div>
  );
}
