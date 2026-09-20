import { useState } from "react";
import { Link, NavLink, Navigate, Outlet, useParams } from "react-router-dom";
import {
  Leaf,
  Menu,
  ArrowUpRight,
  Plus,
  Pencil,
  Trash2,
  Copy,
} from "lucide-react";
import { useStore } from "../../context/Store";
import { api, money } from "../../api/client";
import {
  useData,
  Loading,
  ErrorState,
  Empty,
  Modal,
  SEO,
} from "../../components/UI";
import { config, permission, settingsFields } from "./config";
import { FormEditor } from "./Editor";
const links = [
  ["return_requests", "Return requests", "returns.manage"],
  ["guarantee_claims", "Guarantee claims", "guarantees.manage"],
  ["newsletter_subscribers", "Newsletter", "newsletter.manage"],
  ["stock_notifications", "Stock notifications", "notifications.manage"],
  ...[
    "product_variations",
    "faqs",
    "announcements",
    "delivery_rules",
    "return_policies",
    "guarantee_policies",
    "climate_profiles",
    "calendar_rules",
    "suitable_locations",
    "bundles",
    "bundle_items",
    "footer_columns",
  ].map((key) => [key, config[key].title, config[key].permission]),

  ["", "Dashboard", "dashboard.view"],
  ["products", "Products", "products.view"],
  ["categories", "Categories", "categories.view"],
  ["inventory", "Inventory", "inventory.view"],
  ["orders", "Orders", "orders.view"],
  ["customers", "Customers", "users.view"],
  ["users", "Users", "users.view"],
  ["roles", "Roles & permissions", "roles.view"],
  ["pages", "Pages", "pages.view"],
  ["page-builder", "Page builder", "pages.view"],
  ["sections", "Sections", "sections.edit"],
  ["navigation", "Navigation", "navigation.edit"],
  ["homepage", "Homepage", "pages.view"],
  ["testimonials", "Testimonials", "testimonials.manage"],
  ["reviews", "Reviews", "reviews.manage"],
  ["coupons", "Coupons", "coupons.manage"],
  ["media", "Media library", "media.manage"],
  ["messages", "Contact messages", "messages.manage"],
  ["settings", "Site settings", "settings.manage"],
  ["seo", "SEO", "seo.manage"],
  ["audit-logs", "Audit logs", "audit.view"],
];
export function AdminLayout() {
  const { user, ready, can, logout } = useStore();
  const [open, setOpen] = useState(false);
  if (!ready) return <Loading />;
  if (!user) return <Navigate to="/login" />;
  if (!links.some((l) => can(l[2])))
    return (
      <Empty>
        <h1>403 — Access denied</h1>
        <Link to="/">Back to store</Link>
      </Empty>
    );
  return (
    <div className="admin-layout">
      <SEO data={{ title: "Store administration", noindex: true }} />
      <aside className={"admin-sidebar " + (open ? "open" : "")}>
        <Link to="/admin" className="admin-brand">
          <Leaf /> GHARSA <span>ADMIN</span>
        </Link>
        <nav>
          {links
            .filter((l) => can(l[2]))
            .map(([url, label]) => (
              <NavLink
                key={url}
                end
                to={url ? "/admin/" + url : "/admin"}
                onClick={() => setOpen(false)}
              >
                {label}
              </NavLink>
            ))}
        </nav>
        <Link className="back-store" to="/">
          View storefront <ArrowUpRight size={16} />
        </Link>
      </aside>
      <div className="admin-workspace">
        <header className="admin-header">
          <button
            className="mobile-toggle"
            aria-label="Toggle admin menu"
            onClick={() => setOpen(!open)}
          >
            <Menu />
          </button>
          <span>Store workspace</span>
          <div>
            <span>{user.name}</span>
            <button className="text-button" onClick={logout}>
              Sign out
            </button>
          </div>
        </header>
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
export function Dashboard() {
  const { can } = useStore();
  return can("dashboard.view") ? (
    <DashboardContent />
  ) : (
    <Empty>Select a section from the sidebar to begin.</Empty>
  );
}
function DashboardContent() {
  const { data, error, loading } = useData("/admin/dashboard");
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;
  return (
    <>
      <div className="admin-title">
        <div>
          <p className="eyebrow">A little care. A lot of growth.</p>
          <h1>Store overview</h1>
        </div>
        <Link className="button outline" to="/">
          View store ↗
        </Link>
      </div>
      <div className="stats-grid">
        {Object.entries(data.stats).map(([k, v]) => (
          <div className="stat-card" key={k}>
            <span>{k.replaceAll("_", " ")}</span>
            <strong>{k === "total_sales" ? money(v) : v}</strong>
          </div>
        ))}
      </div>
      <div className="admin-panels">
        <section className="panel">
          <h2>Recent orders</h2>
          <DataTable
            rows={data.recent_orders}
            columns={["order_number", "status", "total", "created_at"]}
          />
        </section>
        <section className="panel">
          <h2>Best selling plants</h2>
          {data.best_sellers.length ? (
            data.best_sellers.map((p) => (
              <div className="order-line" key={p.name}>
                <span>{p.name}</span>
                <b>{p.quantity} sold</b>
              </div>
            ))
          ) : (
            <Empty>Sales will appear after your first order.</Empty>
          )}
        </section>
        <section className="panel">
          <h2>Sales · last 30 days</h2>
          {data.chart.length ? (
            <div className="sales-chart">
              {data.chart.map((d) => (
                <div key={d.day} title={d.day + ": " + money(d.total)}>
                  <span
                    style={{
                      height: Math.max(
                        4,
                        (Number(d.total) /
                          Math.max(...data.chart.map((x) => Number(x.total)))) *
                          140,
                      ),
                    }}
                  />
                  <small>{new Date(d.day).getDate()}</small>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">No sales in this period.</p>
          )}
        </section>
        <section className="panel">
          <h2>Recent customers</h2>
          {data.recent_customers.map((u, i) => (
            <div className="order-line" key={i}>
              {u.name}
              <small>{new Date(u.created_at).toLocaleDateString()}</small>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
function display(value, key) {
  if (typeof value === "boolean")
    return (
      <span className={"badge " + (value ? "green" : "")}>
        {value ? "Yes" : "No"}
      </span>
    );
  if (value === null || value === undefined) return "—";
  if (key.endsWith("_at")) return new Date(value).toLocaleDateString();
  if (typeof value === "object") return JSON.stringify(value);
  if (["total", "regular_price", "sale_price"].includes(key))
    return money(value);
  return String(value);
}
export function DataTable({ rows, columns, actions }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c.replaceAll("_", " ")}</th>
            ))}
            {actions && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id || row.name}>
              {columns.map((c) => (
                <td key={c}>{display(row[c], c)}</td>
              ))}
              {actions && (
                <td>
                  <div className="row-actions">{actions(row)}</div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <Empty>No records found.</Empty>}
    </div>
  );
}
export function ResourcePage({ resource: fixed, customers = false }) {
  const params = useParams();
  const key = fixed || params.resource;
  const c = customers ? { ...config[key], title: "Customers" } : config[key];
  const { can, notify, refreshSite } = useStore();
  const [search, setSearch] = useState(""),
    [editing, setEditing] = useState(null),
    [deleting, setDeleting] = useState(null),
    [busy, setBusy] = useState(false),
    [detail, setDetail] = useState(null);
  const { data, error, loading, reload } = useData(
    "/admin/" + key + (customers ? "?customers=true" : ""),
  );
  if (!c) return <ErrorState message="Page not found" />;
  if (!can(permission(c, "view"))) return <Empty>403 — Access denied</Empty>;
  const refresh = () => {
    reload();
    refreshSite().catch(() => {});
  };
  const rows = (data || []).filter((r) =>
    JSON.stringify(r).toLowerCase().includes(search.toLowerCase()),
  );
  async function edit(row) {
    try {
      setEditing(
        ["users", "roles"].includes(key)
          ? row
          : await api("/admin/" + key + "/" + row.id),
      );
    } catch (e) {
      notify(e.message);
    }
  }
  return (
    <>
      <div className="admin-title">
        <div>
          <p className="eyebrow">Store management</p>
          <h1>{c.title}</h1>
        </div>
        {!c.updateOnly && can(permission(c, "create")) && (
          <button className="button" onClick={() => setEditing({})}>
            <Plus size={17} /> Add{" "}
            {key === "categories" ? "category" : key.replace(/s$/, "")}
          </button>
        )}
      </div>
      {key === "navigation" && (
        <p>
          <Link to="/admin/menus">Manage menu locations</Link> · Category and
          page links take precedence over a custom URL.
        </p>
      )}
      {key === "products" && (
        <p className="muted">
          New products start with zero stock. Use Inventory to record stock
          additions and keep a complete history.
        </p>
      )}
      <div className="panel">
        <div className="table-toolbar">
          <input
            aria-label={"Search " + c.title}
            placeholder={"Search " + c.title.toLowerCase() + "…"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span>{rows.length} records</span>
        </div>
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorState message={error} />
        ) : (
          <DataTable
            rows={rows}
            columns={c.columns}
            actions={(row) => (
              <>
                {["messages", "reviews"].includes(key) && (
                  <button title="View details" onClick={() => setDetail(row)}>
                    View
                  </button>
                )}
                {key === "users" && can("orders.view") && (
                  <button
                    onClick={async () => {
                      try {
                        setDetail({
                          name: row.name,
                          orders: await api(
                            "/admin/users/" + row.id + "/orders",
                          ),
                        });
                      } catch (e) {
                        notify(e.message);
                      }
                    }}
                  >
                    Orders
                  </button>
                )}
                {key === "pages" && (
                  <Link to={"/admin/page-builder?page=" + row.id}>Build</Link>
                )}
                {can(permission(c, "edit")) && !row.protected && (
                  <button
                    title="Edit"
                    aria-label={"Edit " + (row.name || row.title || row.id)}
                    onClick={() => edit(row)}
                  >
                    <Pencil size={16} />
                  </button>
                )}
                {c.duplicate && can(permission(c, "create")) && (
                  <button
                    title="Duplicate"
                    onClick={async () => {
                      try {
                        await api(
                          "/admin/" + key + "/" + row.id + "/duplicate",
                          { method: "POST" },
                        );
                        refresh();
                        notify("Copy created as a draft");
                      } catch (e) {
                        notify(e.message);
                      }
                    }}
                  >
                    <Copy size={16} />
                  </button>
                )}
                {can(permission(c, "delete")) &&
                  !row.protected &&
                  !row.primary_admin && (
                    <button
                      title="Delete"
                      aria-label={"Delete " + (row.name || row.title || row.id)}
                      onClick={() => setDeleting(row)}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
              </>
            )}
          />
        )}
      </div>
      {editing && (
        <Modal
          title={(editing.id ? "Edit " : "Create ") + c.title.replace(/s$/, "")}
          onClose={() => setEditing(null)}
        >
          <FormEditor
            fields={c.fields}
            initial={editing}
            onSave={async (body) => {
              await api(
                "/admin/" + key + (editing.id ? "/" + editing.id : ""),
                { method: editing.id ? "PUT" : "POST", body },
              );
              setEditing(null);
              refresh();
              notify("Changes saved successfully");
            }}
          />
        </Modal>
      )}
      {deleting && (
        <Modal title="Confirm deletion" onClose={() => setDeleting(null)}>
          <p>
            Are you sure you want to delete{" "}
            {deleting.name || deleting.title || deleting.code || "this record"}?
          </p>
          <p>This action cannot be undone.</p>
          <div className="form-actions">
            <button
              className="button outline"
              onClick={() => setDeleting(null)}
            >
              Cancel
            </button>
            <button
              className="button danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api("/admin/" + key + "/" + deleting.id, {
                    method: "DELETE",
                  });
                  setDeleting(null);
                  refresh();
                  notify("Record deleted");
                } catch (e) {
                  notify(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Delete
            </button>
          </div>
        </Modal>
      )}
      {detail && (
        <Modal
          title={detail.name || detail.title || "Details"}
          onClose={() => setDetail(null)}
        >
          {Object.entries(detail).map(([k, v]) => (
            <div key={k}>
              <strong>{k.replaceAll("_", " ")}</strong>
              <p className="pre-wrap">
                {typeof v === "object" ? JSON.stringify(v, null, 2) : String(v)}
              </p>
            </div>
          ))}
        </Modal>
      )}
    </>
  );
}
export function Settings() {
  const { data, error, loading } = useData("/admin/settings");
  const { notify, refreshSite } = useStore();
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;
  return (
    <>
      <h1>Site settings</h1>
      <p className="muted">
        Edit footer branding, contact details, social profiles, promotion and
        newsletter below.{" "}
        <Link to="/admin/footer_columns">
          Manage footer columns and links →
        </Link>
      </p>
      <div className="panel">
        <FormEditor
          fields={settingsFields}
          initial={{
            ...data,
            facebook_url:
              data.facebook_url ??
              data.social_links?.find(
                (link) => link.label.toLowerCase() === "facebook",
              )?.url ??
              "",
            instagram_url:
              data.instagram_url ??
              data.social_links?.find(
                (link) => link.label.toLowerCase() === "instagram",
              )?.url ??
              "",
          }}
          onSave={async (body) => {
            await api("/admin/settings", {
              method: "PUT",
              body: { ...data, ...body },
            });
            await refreshSite();
            notify("Changes saved successfully");
          }}
        />
      </div>
    </>
  );
}
export function AuditLogs() {
  const { data, error, loading } = useData("/admin/audit-logs");
  const [search, setSearch] = useState("");
  return (
    <>
      <h1>Audit logs</h1>
      <div className="panel">
        <input
          aria-label="Search audit logs"
          placeholder="Search activity…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorState message={error} />
        ) : (
          <DataTable
            rows={data.filter((x) =>
              JSON.stringify(x).toLowerCase().includes(search.toLowerCase()),
            )}
            columns={[
              "created_at",
              "user_name",
              "action",
              "resource_type",
              "description",
            ]}
          />
        )}
      </div>
    </>
  );
}
