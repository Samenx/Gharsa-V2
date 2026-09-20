import { useState } from "react";
import { api, money } from "../../api/client";
import { useStore } from "../../context/Store";
import {
  useData,
  Loading,
  ErrorState,
  Modal,
  Field,
} from "../../components/UI";
import { DataTable } from "./Admin";
import { FormEditor } from "./Editor";
export function Inventory() {
  const { data, error, loading, reload } = useData("/admin/inventory");
  const { can, notify } = useStore();
  const [filter, setFilter] = useState("all"),
    [search, setSearch] = useState(""),
    [edit, setEdit] = useState(null),
    [history, setHistory] = useState(null);
  return (
    <>
      <h1>Inventory</h1>
      <div className="panel">
        <div className="table-toolbar">
          <input
            aria-label="Search inventory"
            placeholder="Search name or SKU…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            aria-label="Stock filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All stock</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
          </select>
        </div>
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorState message={error} />
        ) : (
          <DataTable
            rows={data.filter(
              (p) =>
                (p.name + " " + p.sku)
                  .toLowerCase()
                  .includes(search.toLowerCase()) &&
                (filter === "all" ||
                  (filter === "low" &&
                    p.stock_quantity > 0 &&
                    p.stock_quantity <= p.low_stock_threshold) ||
                  (filter === "out" &&
                    (p.stock_quantity === 0 ||
                      p.stock_status === "out_of_stock"))),
            )}
            columns={[
              "name",
              "sku",
              "stock_quantity",
              "low_stock_threshold",
              "stock_status",
            ]}
            actions={(p) => (
              <>
                {can("inventory.edit") && (
                  <button onClick={() => setEdit(p)}>Adjust stock</button>
                )}
                <button
                  onClick={async () => {
                    try {
                      setHistory({
                        name: p.name,
                        items: await api(
                          "/admin/inventory/" + p.id + "/history",
                        ),
                      });
                    } catch (e) {
                      notify(e.message);
                    }
                  }}
                >
                  History
                </button>
              </>
            )}
          />
        )}
      </div>
      {edit && (
        <Modal title={"Adjust " + edit.name} onClose={() => setEdit(null)}>
          <p>
            Current quantity: <strong>{edit.stock_quantity}</strong>. Enter the
            new total after adding or removing stock.
          </p>
          <FormEditor
            initial={{
              quantity: edit.stock_quantity,
              low_stock_threshold: edit.low_stock_threshold,
              stock_status: edit.stock_status,
            }}
            fields={[
              {
                name: "quantity",
                label: "New stock quantity",
                type: "number",
                required: true,
              },
              {
                name: "low_stock_threshold",
                label: "Low stock threshold",
                type: "number",
              },
              {
                name: "stock_status",
                label: "Stock status",
                type: "select",
                options: ["in_stock", "out_of_stock"],
              },
              {
                name: "reason",
                label: "Reason for adjustment",
                type: "text",
                required: true,
              },
            ]}
            onSave={async (body) => {
              await api("/admin/inventory/" + edit.id, {
                method: "POST",
                body,
              });
              setEdit(null);
              reload();
              notify("Stock updated and recorded in history");
            }}
          />
        </Modal>
      )}
      {history && (
        <Modal
          title={history.name + " — stock history"}
          onClose={() => setHistory(null)}
        >
          <DataTable
            rows={history.items}
            columns={[
              "created_at",
              "delta",
              "before_quantity",
              "after_quantity",
              "reason",
            ]}
          />
        </Modal>
      )}
    </>
  );
}
export function AdminOrders() {
  const { data, error, loading, reload } = useData("/admin/orders");
  const { can, notify } = useStore();
  const [selected, setSelected] = useState(null),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState(""),
    [busy, setBusy] = useState(false);
  const transitions = {
    pending: ["processing", "paid", "cancelled"],
    processing: ["paid", "shipped", "cancelled"],
    paid: ["shipped", "cancelled", "refunded"],
    shipped: ["completed", "refunded"],
    completed: ["refunded"],
    cancelled: [],
    refunded: [],
  };
  return (
    <>
      <h1>Orders</h1>
      <div className="panel">
        <div className="table-toolbar">
          <input
            aria-label="Search orders"
            placeholder="Search order or customer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            aria-label="Order status"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            {Object.keys(transitions).map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorState message={error} />
        ) : (
          <DataTable
            rows={data.filter(
              (o) =>
                (!filter || o.status === filter) &&
                JSON.stringify(o).toLowerCase().includes(search.toLowerCase()),
            )}
            columns={[
              "order_number",
              "customer",
              "total",
              "status",
              "payment_status",
              "created_at",
            ]}
            actions={(o) => (
              <button
                onClick={async () => {
                  try {
                    setSelected(await api("/admin/orders/" + o.id));
                  } catch (e) {
                    notify(e.message);
                  }
                }}
              >
                View order
              </button>
            )}
          />
        )}
      </div>
      {selected && (
        <Modal title={selected.order_number} onClose={() => setSelected(null)}>
          <p>
            <strong>{selected.customer.name}</strong>
            <br />
            {selected.customer.email}
            <br />
            {selected.customer.phone}
          </p>
          <p>
            {selected.shipping_address.address},{" "}
            {selected.shipping_address.city}
            <br />
            {selected.shipping_address.additional_address}
          </p>
          <DataTable
            rows={selected.items}
            columns={["name", "quantity", "unit_price"]}
          />
          <p>
            Subtotal {money(selected.subtotal)} · Discount{" "}
            {money(selected.discount)} · Shipping {money(selected.shipping)} ·
            Tax {money(selected.tax)}
          </p>
          <h3>Total {money(selected.total)}</h3>
          <p>
            Payment: {selected.payment_method} / {selected.payment_status}
          </p>
          <p>Notes: {selected.notes || "None"}</p>
          <p>
            Current status: <strong>{selected.status}</strong>
          </p>
          {can("orders.edit") && transitions[selected.status].length > 0 && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const status = new FormData(e.currentTarget).get("status");
                if (
                  ["cancelled", "refunded"].includes(status) &&
                  !window.confirm("This will restore inventory. Continue?")
                )
                  return;
                setBusy(true);
                try {
                  const o = await api("/admin/orders/" + selected.id, {
                    method: "PUT",
                    body: { status },
                  });
                  setSelected({ ...selected, ...o });
                  reload();
                  notify("Order updated");
                } catch (e) {
                  notify(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <select name="status">
                {transitions[selected.status]
                  .filter((s) => s !== "refunded" || can("orders.refund"))
                  .map((s) => (
                    <option key={s}>{s}</option>
                  ))}
              </select>
              <button className="button" disabled={busy}>
                Update status
              </button>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}
export function MediaLibrary() {
  const { data, error, loading, reload } = useData("/admin/media");
  const { notify } = useStore();
  const [selected, setSelected] = useState(null),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState("");
  return (
    <>
      <div className="admin-title">
        <h1>Media library</h1>
        <label className="upload-button">
          {busy ? "Uploading…" : "Upload image"}
          <input
            disabled={busy}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            onChange={async (e) => {
              const file = e.target.files[0];
              if (!file) return;
              setBusy(true);
              const body = new FormData();
              body.append("image", file);
              try {
                await api("/admin/media", { method: "POST", body });
                reload();
                notify("Image uploaded");
              } catch (e) {
                notify(e.message);
              } finally {
                setBusy(false);
                e.target.value = "";
              }
            }}
          />
        </label>
      </div>
      <p className="muted">
        JPG, PNG, WebP, or AVIF · up to 5 MB. Images are validated and converted
        to WebP.
      </p>
      <input
        aria-label="Search media"
        placeholder="Search images…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <div className="media-grid">
          {data
            .filter((m) =>
              (m.title + " " + m.alt)
                .toLowerCase()
                .includes(search.toLowerCase()),
            )
            .map((m) => (
              <button key={m.id} onClick={() => setSelected(m)}>
                <img src={m.path} alt={m.alt} />
                <span>{m.title}</span>
              </button>
            ))}
        </div>
      )}
      {selected && (
        <Modal title="Image details" onClose={() => setSelected(null)}>
          <img
            className="media-preview"
            src={selected.path}
            alt={selected.alt}
          />
          <p className="code">{selected.path}</p>
          <FormEditor
            initial={selected}
            fields={[
              { name: "title", label: "Title", type: "text" },
              { name: "alt", label: "Alt text", type: "text" },
            ]}
            onSave={async (body) => {
              await api("/admin/media/" + selected.id, { method: "PUT", body });
              setSelected(null);
              reload();
              notify("Image metadata saved");
            }}
          />
          <button
            className="button danger"
            onClick={async () => {
              if (!window.confirm("Delete this unused image permanently?"))
                return;
              try {
                await api("/admin/media/" + selected.id, { method: "DELETE" });
                setSelected(null);
                reload();
                notify("Image deleted");
              } catch (e) {
                notify(e.message);
              }
            }}
          >
            Delete unused image
          </button>
        </Modal>
      )}
    </>
  );
}
export function SEOEditor() {
  const { data, error, loading, reload } = useData("/admin/seo");
  const { notify } = useStore();
  const [edit, setEdit] = useState(null);
  return (
    <>
      <h1>SEO</h1>
      <p>
        <a href="/sitemap.xml" target="_blank" rel="noreferrer">
          View sitemap.xml
        </a>{" "}
        ·{" "}
        <a href="/robots.txt" target="_blank" rel="noreferrer">
          View robots.txt
        </a>
      </p>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        Object.entries(data).map(([type, rows]) => (
          <section className="panel" key={type}>
            <h2>{type}</h2>
            <DataTable
              rows={rows}
              columns={["label", "slug", "seo_title", "noindex"]}
              actions={(row) => (
                <button onClick={() => setEdit({ ...row, type })}>
                  Edit SEO
                </button>
              )}
            />
          </section>
        ))
      )}
      {edit && (
        <Modal title={"SEO · " + edit.label} onClose={() => setEdit(null)}>
          <FormEditor
            initial={edit}
            fields={[
              { name: "seo_title", label: "SEO title", type: "text" },
              {
                name: "meta_description",
                label: "Meta description",
                type: "textarea",
              },
              { name: "canonical_url", label: "Canonical URL", type: "url" },
              {
                name: "noindex",
                label: "Exclude from search indexing",
                type: "checkbox",
              },
            ]}
            onSave={async (body) => {
              await api("/admin/seo/" + edit.type + "/" + edit.id, {
                method: "PUT",
                body,
              });
              setEdit(null);
              reload();
              notify("SEO saved");
            }}
          />
        </Modal>
      )}
    </>
  );
}
