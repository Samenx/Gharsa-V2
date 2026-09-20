import {useSaved} from "../context/Saved";
import {tr} from "../i18n";
import ServiceRequests,{ServiceRequestButton} from "./ServiceRequests";
import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useStore } from "../context/Store";
import { api, money } from "../api/client";
import {
  Field,
  useData,
  Loading,
  ErrorState,
  Empty,
  SEO,
} from "../components/UI";
import { ProductCard } from "../components/Products";
export function Auth({ register = false }) {
  const { authenticate, user } = useStore();
  const navigate = useNavigate();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/account" replace />;
  return (
    <section className="auth-card">
      <SEO
        data={{ title: register ? tr("Create account") : tr("Sign in"), noindex: true }}
      />
      <p className="eyebrow">{tr("Welcome to GHARSA")}</p>
      <h1>{register ? tr("Create an account") : tr("Welcome back")}</h1>
      <p className="muted">{tr("A little closer to your next favourite plant.")}</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const u = await authenticate(
              register ? "register" : "login",
              Object.fromEntries(new FormData(e.currentTarget)),
            );
            navigate(
              u.roles.some((r) => r !== "CUSTOMER") ? "/admin" : "/account",
            );
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {register && (
          <>
            <Field name="name" label={tr("Full name")} autoComplete="name" required />
            <Field
              name="phone"
              label={tr("Phone")}
              type="tel"
              autoComplete="tel"
              required
            />
          </>
        )}
        <Field
          name="email"
          label={tr("Email address")}
          type="email"
          autoComplete="email"
          required
        />
        <Field
          name="password"
          label={tr("Password")}
          type="password"
          autoComplete={register ? "new-password" : "current-password"}
          minLength={register ? 10 : undefined}
          maxLength={72}
          required
        />
        {register && (
          <Field
            name="confirm_password"
            label={tr("Confirm password")}
            type="password"
            autoComplete="new-password"
            required
          />
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="button full" disabled={busy}>
          {busy ? "Please wait…" : register ? tr("Create account") : tr("Sign in")}
        </button>
      </form>
      <p>
        {register ? tr("Already have an account?") : "New to GHARSA?"}{" "}
        <Link to={register ? "/login" : "/register"}>
          {register ? tr("Sign in") : tr("Create an account")}
        </Link>
      </p>
    </section>
  );
}
function Orders() {
  const { id } = useParams();
  const { data, error, loading } = useData(id ? "/orders/" + id : "/orders");
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;
  if (id)
    return (
      <>
        <h2>{tr("Order")}{" "}{data.order_number}</h2>
        <p className="badge">{data.status}</p>
        <p>
          {data.shipping_address.address}, {data.shipping_address.city}
        </p>
        {data.items.map((i) => (
          <div className="order-line" key={i.id}>
            <span>
              {i.name} × {i.quantity}
            </span>
            <strong>{money(i.unit_price * i.quantity)}</strong>
            {data.status==="completed"&&<ServiceRequestButton item={i}/>}
          </div>
        ))}
        <p>{tr("Total:")}{" "}{money(data.total)}</p>
        <Link to="/account/orders">{tr("All orders")}</Link>
      </>
    );
  return (
    <>
      <h2>{tr("Your orders")}</h2>
      {data.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{tr("Order")}</th>
                <th>{tr("Date")}</th>
                <th>{tr("Status")}</th>
                <th>{tr("Total")}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link to={"/account/orders/" + o.id}>{o.order_number}</Link>
                  </td>
                  <td>{new Date(o.created_at).toLocaleDateString()}</td>
                  <td>
                    <span className="badge">{o.status}</span>
                  </td>
                  <td>{money(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>{tr("No orders yet.")}<Link to="/shop">{tr("Find your first plant")}</Link>.
        </Empty>
      )}
    </>
  );
}
function Wishlist() {
  const {save}=useSaved();
  const { data, error, loading, reload } = useData("/wishlist");
  const { notify, addToCart } = useStore();
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;
  return (
    <>
      <h2>{tr("Your wishlist")}</h2>
      {data.length ? (
        <div className="product-grid" style={{ "--columns": 3 }}>
          {data.map((p) => (
            <div key={p.id}>
              <ProductCard product={p} />
              <button
                className="button small"
                onClick={async () => {
                  if (addToCart(p)) {
                    try {
                      await save(p.id);
                      reload();
                    } catch (e) {
                      notify(e.message);
                    }
                  }
                }}
              >{tr("Move to cart")}</button>
              <button
                className="text-button"
                onClick={async () => {
                  try {
                    await save(p.id);
                    reload();
                  } catch (e) {
                    notify(e.message);
                  }
                }}
              >{tr("Remove from wishlist")}</button>
            </div>
          ))}
        </div>
      ) : (
        <Empty>{tr("Your wishlist is waiting for something green.")}</Empty>
      )}
    </>
  );
}
function Addresses() {
  const { data, reload } = useData("/auth/addresses");
  const { notify } = useStore();
  const [busy, setBusy] = useState(false),
    [editing, setEditing] = useState(null);
  return (
    <>
      <h2>{tr("Saved addresses")}</h2>
      {data?.map((a) => (
        <article className="address-card" key={a.id}>
          <h3>{a.label}</h3>
          <p>
            {a.first_name} {a.last_name}
            <br />
            {a.address}, {a.city}
            <br />
            {a.phone}
          </p>
          <button className="text-button" onClick={() => setEditing(a)}>{tr("Edit")}</button>
          {" · "}
          <button
            className="text-button"
            onClick={async () => {
              try {
                await api("/auth/addresses/" + a.id, { method: "DELETE" });
                reload();
              } catch (e) {
                notify(e.message);
              }
            }}
          >{tr("Remove")}</button>
        </article>
      ))}
      <h3>{editing ? "Edit address" : tr("Add address")}</h3>
      {editing && (
        <button className="text-button" onClick={() => setEditing(null)}>{tr("Cancel editing")}</button>
      )}
      <form
        key={editing?.id || "new"}
        className="form-grid"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = e.currentTarget;
          setBusy(true);
          try {
            await api("/auth/addresses" + (editing ? "/" + editing.id : ""), {
              method: editing ? "PUT" : "POST",
              body: {
                ...Object.fromEntries(new FormData(f)),
                country: "Jordan",
              },
            });
            reload();
            f.reset();
            setEditing(null);
            notify("Address saved");
          } catch (e) {
            notify(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {[
          "label",
          "first_name",
          "last_name",
          "phone",
          "address",
          "city",
          "additional_address",
        ].map((k) => (
          <Field
            key={k}
            label={k.replaceAll("_", " ")}
            name={k}
            defaultValue={editing?.[k] || ""}
            required={k !== "additional_address"}
          />
        ))}
        <button className="button" disabled={busy}>{tr("Save address")}</button>
      </form>
    </>
  );
}
export default function Account() {
  const { tab } = useParams();
  const { user, setUser, ready, logout, notify } = useStore();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  if (!ready) return <Loading />;
  if (!user) return <Navigate to="/login" />;
  return (
    <div className="container section">
      <SEO data={{ title: tr("My account"), noindex: true }} />
      <h1>{tr("My account")}</h1>
      <div className="account-layout">
        <aside>
          {[
            ["", tr("Overview")],
            ["profile", tr("Profile")],
            ["orders", tr("Orders")],
            ["addresses", tr("Addresses")],
            ["wishlist", tr("Wishlist")],
            ["settings", tr("Account settings")],
            ["requests", tr("Returns & guarantee")],
          ].map(([path, label]) => (
            <Link
              className={tab === path || (!tab && !path) ? "selected" : ""}
              key={path}
              to={"/account/" + path}
            >
              {label}
            </Link>
          ))}
          <button
            onClick={async () => {
              await logout();
              navigate("/login");
            }}
          >{tr("Logout")}</button>
        </aside>
        <section>
          {tab === "requests" ? <ServiceRequests/> : tab === "orders" ? (
            <Orders />
          ) : tab === "wishlist" ? (
            <Wishlist />
          ) : tab === "addresses" ? (
            <Addresses />
          ) : tab === "profile" ? (
            <>
              <h2>{tr("Your profile")}</h2>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  try {
                    setUser(
                      await api("/auth/profile", {
                        method: "PUT",
                        body: Object.fromEntries(new FormData(e.currentTarget)),
                      }),
                    );
                    notify("Profile saved");
                  } catch (e) {
                    notify(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Field
                  label={tr("Name")}
                  name="name"
                  defaultValue={user.name}
                  required
                />
                <Field label={tr("Phone")} name="phone" defaultValue={user.phone} />
                <Field label={tr("Email")} value={user.email} readOnly />
                <button className="button" disabled={busy}>{tr("Save changes")}</button>
              </form>
            </>
          ) : tab === "settings" ? (
            <>
              <h2>{tr("Change password")}</h2>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  const f = e.currentTarget;
                  try {
                    const r = await api("/auth/password", {
                      method: "PUT",
                      body: Object.fromEntries(new FormData(f)),
                    });
                    sessionStorage.setItem("gharsa_token", r.token);
                    notify("Password changed");
                    f.reset();
                  } catch (e) {
                    notify(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Field
                  name="current_password"
                  label={tr("Current password")}
                  type="password"
                  required
                />
                <Field
                  name="password"
                  label={tr("New password")}
                  type="password"
                  minLength={10}
                  maxLength={72}
                  required
                />
                <Field
                  name="confirm_password"
                  label={tr("Confirm new password")}
                  type="password"
                  required
                />
                <button className="button" disabled={busy}>{tr("Change password")}</button>
              </form>
            </>
          ) : (
            <>
              <h2>{tr("Hello,")}{" "}{user.name}.</h2>
              <p>{tr("Manage your orders, save your favourite plants, and keep your details up to date.")}</p>
              <Link className="button" to="/shop">{tr("Discover your next plant")}</Link>
              {user.roles.some((r) => r !== "CUSTOMER") && (
                <p>
                  <Link to="/admin">{tr("Open store administration →")}</Link>
                </p>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
