import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { useStore } from "../../context/Store";
import { Modal, Loading, Field } from "../../components/UI";
export function MediaPicker({ value, onChange }) {
  const { can, notify } = useStore();
  const [open, setOpen] = useState(false),
    [media, setMedia] = useState([]);
  const load = () =>
    api("/admin/media")
      .then(setMedia)
      .catch((e) => notify(e.message));
  return (
    <div className="image-field">
      <input
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="/uploads/image.webp"
      />
      {can("media.manage") && (
        <button
          className="button outline small"
          type="button"
          onClick={() => {
            load();
            setOpen(true);
          }}
        >
          Media library
        </button>
      )}
      {value && <img src={value} alt="Selected media" />}
      {open && (
        <Modal title="Select an image" onClose={() => setOpen(false)}>
          <label className="upload-button">
            Upload an image
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/avif"
              onChange={async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const body = new FormData();
                body.append("image", file);
                try {
                  const m = await api("/admin/media", { method: "POST", body });
                  onChange(m.path);
                  setOpen(false);
                } catch (e) {
                  notify(e.message);
                }
              }}
            />
          </label>
          <div className="media-grid">
            {media.map((m) => (
              <button
                type="button"
                key={m.id}
                onClick={() => {
                  onChange(m.path);
                  setOpen(false);
                }}
              >
                <img src={m.path} alt={m.alt} />
                <span>{m.title}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
function ReferenceField({ field: f, value, onChange }) {
  const [rows, setRows] = useState([]),
    [error, setError] = useState("");
  useEffect(() => {
    api("/admin/" + f.resource)
      .then(setRows)
      .catch((e) => setError(e.message));
  }, [f.resource]);
  if (error) return <p className="error">{error}</p>;
  if (f.type === "multireference")
    return (
      <div className="permission-grid">
        {rows.map((r) => (
          <label className="check" key={r.id}>
            <input
              type="checkbox"
              checked={(value || []).includes(r.id)}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...(value || []), r.id]
                    : (value || []).filter((id) => id !== r.id),
                )
              }
            />
            {r.name || r.title || r.label}
          </label>
        ))}
      </div>
    );
  return (
    <select
      aria-label={f.label}
      value={value ?? ""}
      required={f.required}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
    >
      <option value="">None</option>
      {rows.map((r) => (
        <option key={r.id} value={r.id}>
          {r.name || r.title || r.label} (#{r.id})
        </option>
      ))}
    </select>
  );
}
function CollectionEditor({ type, value = [], onChange }) {
  const gallery = type === "gallery";
  return (
    <div>
      {value.map((item, i) => (
        <div className="config-item" key={i}>
          {gallery ? (
            <>
              <MediaPicker
                value={item.path}
                onChange={(v) =>
                  onChange(
                    value.map((a, n) => (n === i ? { ...a, path: v } : a)),
                  )
                }
              />
              <Field
                label="Image alt text"
                value={item.alt || ""}
                onChange={(e) =>
                  onChange(
                    value.map((a, n) =>
                      n === i ? { ...a, alt: e.target.value } : a,
                    ),
                  )
                }
              />
            </>
          ) : (
            <div className="form-grid">
              <Field
                label="Attribute name"
                value={item.name}
                required
                onChange={(e) =>
                  onChange(
                    value.map((a, n) =>
                      n === i ? { ...a, name: e.target.value } : a,
                    ),
                  )
                }
              />
              <Field
                label="Attribute value"
                value={item.value}
                onChange={(e) =>
                  onChange(
                    value.map((a, n) =>
                      n === i ? { ...a, value: e.target.value } : a,
                    ),
                  )
                }
              />
              <label className="field">Specification group<select value={item.attribute_group||'care'} onChange={e=>onChange(value.map((a,n)=>n===i?{...a,attribute_group:e.target.value}:a))}>{['care','size','flowering','foliage','botanical','soil','climate'].map(g=><option key={g}>{g}</option>)}</select></label>
              <label className="field">Filter key<select value={item.attribute_key||''} onChange={e=>onChange(value.map((a,n)=>n===i?{...a,attribute_key:e.target.value}:a))}><option value="">Not used as filter</option>{['light','watering','difficulty','size'].map(g=><option key={g}>{g}</option>)}</select></label>
              <Field label="Arabic attribute name" value={item.translations?.ar?.name||''} onChange={e=>onChange(value.map((a,n)=>n===i?{...a,translations:{...a.translations,ar:{...a.translations?.ar,name:e.target.value}}}:a))}/>
              <Field label="Arabic attribute value" value={item.translations?.ar?.value||''} onChange={e=>onChange(value.map((a,n)=>n===i?{...a,translations:{...a.translations,ar:{...a.translations?.ar,value:e.target.value}}}:a))}/>
            </div>
          )}
          <div className="row-actions">
            <button
              type="button"
              disabled={!i}
              onClick={() => {
                const next = [...value];
                [next[i - 1], next[i]] = [next[i], next[i - 1]];
                onChange(next);
              }}
            >
              Move up
            </button>
            <button
              type="button"
              onClick={() => onChange(value.filter((_, n) => n !== i))}
            >
              Remove
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="button outline small"
        onClick={() =>
          onChange([
            ...value,
            gallery ? { path: "", alt: "" } : { name: "", value: "" },
          ])
        }
      >
        Add {gallery ? "image" : "attribute"}
      </button>
    </div>
  );
}
export function DynamicField({ field: f, value, onChange }) {
  if (f.type === "checkbox")
    return (
      <label className="check">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
        />
        {f.label}
      </label>
    );
  return (
    <div
      className={
        "field " +
        ([
          "textarea",
          "json",
          "multireference",
          "gallery",
          "attributes",
        ].includes(f.type)
          ? "span-two"
          : "")
      }
    >
      <label>
        {f.label}
        {f.required ? " *" : ""}
      </label>
      {["gallery", "attributes"].includes(f.type) ? (
        <CollectionEditor
          type={f.type}
          value={value || []}
          onChange={onChange}
        />
      ) : f.type === "image" ? (
        <MediaPicker value={value} onChange={onChange} />
      ) : f.type.includes("reference") ? (
        <ReferenceField field={f} value={value} onChange={onChange} />
      ) : f.type === "select" ? (
        <select
          aria-label={f.label}
          value={value || f.options[0]}
          onChange={(e) => onChange(e.target.value)}
        >
          {f.options.map((o) => (
            <option key={o} value={o}>
              {o.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      ) : ["textarea", "json"].includes(f.type) ? (
        <textarea
          aria-label={f.label}
          rows={f.type === "json" ? 6 : 4}
          required={f.required}
          className={f.type === "json" ? "code" : ""}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          aria-label={f.label}
          type={f.type}
          required={f.required}
          value={value ?? ""}
          min={f.min ?? (f.type === "number" ? 0 : undefined)}
          max={f.max}
          step={f.type === "number" ? "any" : undefined}
          autoComplete={f.type === "password" ? "new-password" : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      )}{" "}
      {f.hint && <small className="muted">{f.hint}</small>}
    </div>
  );
}
export function FormEditor({
  fields,
  initial = {},
  onSave,
  children,
  submitLabel = "Save changes",
}) {
  const { can } = useStore();
  const available = fields.filter((f) => !f.permission || can(f.permission));
  const [data, setData] = useState(() =>
      Object.fromEntries(
        available.map((f) => {
          let v =
            initial[f.name] ??
            f.initial ??
            (f.type === "checkbox"
              ? false
              : f.type === "number" && !f.nullable
                ? 0
                : f.type === "select"
                  ? f.options[0]
                  : "");
          if (f.type === "json") v = JSON.stringify(v || {}, null, 2);
          if (f.type === "datetime-local" && v)
            v = new Date(
              new Date(v).getTime() - new Date(v).getTimezoneOffset() * 60000,
            )
              .toISOString()
              .slice(0, 16);
          return [f.name, v];
        }),
      ),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          const body = {};
          for (const f of available) {
            let v = data[f.name];
            if (f.type === "password" && !v) continue;
            if (f.type === "json") {
              try {
                v = JSON.parse(v);
              } catch {
                throw Error(f.label + " must be valid JSON.");
              }
            } else if (v === "" && f.nullable) v = null;
            else if (f.type === "number") v = Number(v);
            else if (f.type === "datetime-local" && v)
              v = new Date(v).toISOString();
            body[f.name] = v;
          }
          await onSave(body);
        } catch (e) {
          setError(e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="form-grid">
        {available.map((f) => (
          <DynamicField
            key={f.name}
            field={f}
            value={data[f.name]}
            onChange={(v) => setData({ ...data, [f.name]: v })}
          />
        ))}
      </div>
      {children}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button className="button" disabled={busy}>
          {busy ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
