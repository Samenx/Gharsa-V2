import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowUp,
  ArrowDown,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  Plus,
} from "lucide-react";
import { api } from "../../api/client";
import { useStore } from "../../context/Store";
import { useData, Loading, ErrorState, Modal } from "../../components/UI";
import { FormEditor, DynamicField, MediaPicker } from "./Editor";
import { sectionDefaults, config } from "./config";
function ConfigEditor({ value, onChange }) {
  return (
    <div className="section-config">
      {Object.entries(value).map(([k, v]) => (
        <div className="field" key={k}>
          <label>{k.replaceAll("_", " ")}</label>
          {Array.isArray(v) && ["slides", "items", "images"].includes(k) ? (
            <>
              <div>
                {v.map((item, i) => (
                  <div className="config-item" key={i}>
                    <ConfigEditor
                      value={item}
                      onChange={(next) =>
                        onChange({
                          ...value,
                          [k]: v.map((old, n) => (n === i ? next : old)),
                        })
                      }
                    />
                    <div className="row-actions">
                      <button
                        type="button"
                        disabled={!i}
                        onClick={() => {
                          const next = [...v];
                          [next[i - 1], next[i]] = [next[i], next[i - 1]];
                          onChange({ ...value, [k]: next });
                        }}
                      >
                        ↑ Move up
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onChange({
                            ...value,
                            [k]: v.filter((_, n) => n !== i),
                          })
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button
                className="button outline small"
                type="button"
                onClick={() =>
                  onChange({
                    ...value,
                    [k]: [
                      ...v,
                      k === "slides"
                        ? {
                            image: "",
                            mobile_image: "",
                            secondary_url: "/faq",
                            secondary_button: "Find your plant",
                            translations: {
                              ar: {
                                title: "",
                                text: "",
                                button: "",
                                secondary_button: "",
                              },
                            },
                            alt: "",
                            url: "/shop",
                            title: "",
                            text: "",
                            button: "Shop Now",
                          }
                        : k === "images"
                          ? { image: "", alt: "" }
                          : { title: "", text: "" },
                    ],
                  })
                }
              >
                Add {k === "slides" ? "slide" : "item"}
              </button>
            </>
          ) : Array.isArray(v) ? (
            <input
              aria-label={k}
              value={v.join(", ")}
              placeholder="IDs separated by commas"
              onChange={(e) =>
                onChange({
                  ...value,
                  [k]: e.target.value
                    .split(",")
                    .map((s) => Number(s.trim()))
                    .filter((n) => Number.isInteger(n) && n > 0),
                })
              }
            />
          ) : v && typeof v === "object" ? (
            <ConfigEditor
              value={v}
              onChange={(next) => onChange({ ...value, [k]: next })}
            />
          ) : typeof v === "boolean" ? (
            <label className="check">
              <input
                type="checkbox"
                checked={v}
                onChange={(e) => onChange({ ...value, [k]: e.target.checked })}
              />{" "}
              Enabled
            </label>
          ) : ["image", "mobile_image"].includes(k) ? (
            <MediaPicker
              value={v}
              onChange={(next) => onChange({ ...value, [k]: next })}
            />
          ) : (
            <input
              aria-label={k}
              type={typeof v === "number" ? "number" : "text"}
              value={v ?? ""}
              onChange={(e) =>
                onChange({
                  ...value,
                  [k]:
                    typeof v === "number"
                      ? Number(e.target.value)
                      : e.target.value,
                })
              }
            />
          )}
        </div>
      ))}
    </div>
  );
}
function SliderSettings({ value, onChange }) {
  const update = (key, next) => onChange({ ...value, [key]: next });
  return (
    <fieldset className="slider-settings panel">
      <legend>Slider animation</legend>
      <label className="field">
        Animation style
        <select
          value={value.animation_style ?? "fade"}
          onChange={(e) => update("animation_style", e.target.value)}
        >
          <option value="fade">Smooth fade</option>
          <option value="slide">Slide and fade</option>
          <option value="zoom">Gentle zoom</option>
          <option value="none">Instant (no animation)</option>
        </select>
      </label>
      <label className="field">
        Transition duration (milliseconds)
        <input
          type="number"
          min="100"
          max="3000"
          step="100"
          required
          disabled={value.animation_style === "none"}
          value={value.transition_ms ?? 900}
          onChange={(e) =>
            update(
              "transition_ms",
              e.target.value === "" ? "" : Number(e.target.value),
            )
          }
        />
        <small>
          100–3000 ms. A longer duration makes the transition slower and
          smoother.
        </small>
      </label>
      <label className="field">
        Time between slides (seconds)
        <input
          type="number"
          min="2"
          max="30"
          step="0.5"
          required
          value={
            value.slide_interval_ms === ""
              ? ""
              : (value.slide_interval_ms ?? 6000) / 1000
          }
          onChange={(e) =>
            update(
              "slide_interval_ms",
              e.target.value === "" ? "" : Number(e.target.value) * 1000,
            )
          }
        />
        <small>
          2–30 seconds between automatic transitions. Long transitions finish
          before the next slide starts.
        </small>
      </label>
      <small>
        Applies to this slider. Visitors who prefer reduced motion see instant
        transitions.
      </small>
    </fieldset>
  );
}
export default function PageBuilder({ home = false }) {
  const { data: pages, error, loading } = useData("/admin/pages");
  const { data: allSections, reload } = useData("/admin/sections");
  const { can, notify } = useStore();
  const [params, setParams] = useSearchParams(),
    [editing, setEditing] = useState(null),
    [configuration, setConfiguration] = useState({}),
    [type, setType] = useState("text"),
    [busy, setBusy] = useState(false);
  const page = home
    ? pages?.find((p) => p.slug === "home")
    : pages?.find((p) => p.id === Number(params.get("page"))) || pages?.[0];
  const sections = (allSections || [])
    .filter((s) => s.page_id === page?.id)
    .sort((a, b) => a.display_order - b.display_order || a.id - b.id);
  const editable = can("sections.edit");
  const open = (s) => {
    setEditing(s);
    setType(s.section_type || "text");
    setConfiguration(s.configuration || {});
  };
  const save = async (s) => {
    await api("/admin/sections/" + s.id, { method: "PUT", body: s });
    reload();
  };
  async function move(i, dir) {
    setBusy(true);
    try {
      const reordered = [...sections];
      [reordered[i], reordered[i + dir]] = [reordered[i + dir], reordered[i]];
      await api("/admin/sections/reorder", {
        method: "POST",
        body: { page_id: page.id, ids: reordered.map((s) => s.id) },
      });
      reload();
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;
  return (
    <>
      <div className="admin-title">
        <div>
          <p className="eyebrow">Content studio</p>
          <h1>{home ? "Homepage" : "Page builder"}</h1>
        </div>
        {page && (
          <Link
            className="button outline"
            target="_blank"
            to={page.slug === "home" ? "/" : "/" + page.slug}
          >
            View published page ↗
          </Link>
        )}
      </div>
      <div className="builder-bar">
        {!home && (
          <select
            aria-label="Page"
            value={page?.id || ""}
            onChange={(e) => setParams({ page: e.target.value })}
          >
            {pages?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
                {p.published ? "" : " (draft)"}
              </option>
            ))}
          </select>
        )}
        <span className="badge">{page?.published ? "Published" : "Draft"}</span>
        {editable && page && (
          <button
            className="button"
            onClick={() =>
              open({
                page_id: page.id,
                section_type: "text",
                title: "",
                enabled: true,
                display_order: sections.length * 10,
                configuration: {},
              })
            }
          >
            <Plus size={16} /> Add section
          </button>
        )}
      </div>
      <p className="muted">
        Sections appear in this order. Saved changes to published pages are
        visible on the storefront.
      </p>
      {sections.map((s, i) => (
        <article
          className={"builder-section " + (!s.enabled ? "disabled" : "")}
          key={s.id}
        >
          <span className="section-number">
            {String(i + 1).padStart(2, "0")}
          </span>
          <div>
            <small className="eyebrow">
              {s.section_type.replaceAll("_", " ")}
            </small>
            <h3>{s.title || "Untitled section"}</h3>
            <p className="muted">{s.subtitle}</p>
          </div>
          {editable && (
            <div className="row-actions">
              <button
                disabled={!i || busy}
                aria-label="Move section up"
                onClick={() => move(i, -1)}
              >
                <ArrowUp size={17} />
              </button>
              <button
                disabled={i === sections.length - 1 || busy}
                aria-label="Move section down"
                onClick={() => move(i, 1)}
              >
                <ArrowDown size={17} />
              </button>
              <button
                aria-label="Toggle section visibility"
                onClick={() =>
                  save({ ...s, enabled: !s.enabled }).catch((e) =>
                    notify(e.message),
                  )
                }
              >
                {s.enabled ? <Eye size={17} /> : <EyeOff size={17} />}
              </button>
              <button
                aria-label="Duplicate section"
                onClick={async () => {
                  try {
                    await api("/admin/sections", {
                      method: "POST",
                      body: {
                        ...s,
                        title: s.title + " (copy)",
                        display_order: s.display_order + 1,
                      },
                    });
                    reload();
                  } catch (e) {
                    notify(e.message);
                  }
                }}
              >
                <Copy size={17} />
              </button>
              <button onClick={() => open(s)}>Edit</button>
              <button
                aria-label="Delete section"
                onClick={async () => {
                  if (!window.confirm("Delete this section?")) return;
                  try {
                    await api("/admin/sections/" + s.id, { method: "DELETE" });
                    reload();
                  } catch (e) {
                    notify(e.message);
                  }
                }}
              >
                <Trash2 size={17} />
              </button>
            </div>
          )}
        </article>
      ))}
      {!sections.length && (
        <div className="panel">Add a section to start building this page.</div>
      )}
      {editing && (
        <Modal
          title={editing.id ? "Edit section" : "Add section"}
          onClose={() => setEditing(null)}
        >
          <label className="field">
            Section type
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setConfiguration(
                  structuredClone(sectionDefaults[e.target.value] || {}),
                );
              }}
            >
              {config.sections.fields
                .find((f) => f.name === "section_type")
                .options.map((t) => (
                  <option key={t} value={t}>
                    {t.replaceAll("_", " ")}
                  </option>
                ))}
            </select>
          </label>
          <FormEditor
            initial={editing}
            fields={config.sections.fields.filter((f) =>
              ["title", "subtitle", "content", "enabled"].includes(f.name),
            )}
            onSave={async (body) => {
              await api(
                "/admin/sections" + (editing.id ? "/" + editing.id : ""),
                {
                  method: editing.id ? "PUT" : "POST",
                  body: {
                    ...editing,
                    ...body,
                    section_type: type,
                    configuration,
                  },
                },
              );
              setEditing(null);
              reload();
              notify("Changes saved successfully");
            }}
          >
            <h3>Section settings</h3>
            {["hero", "image_slider"].includes(type) && (
              <SliderSettings
                value={configuration}
                onChange={setConfiguration}
              />
            )}
            <ConfigEditor
              value={
                ["hero", "image_slider"].includes(type)
                  ? Object.fromEntries(
                      Object.entries(configuration).filter(
                        ([key]) =>
                          ![
                            "animation_style",
                            "transition_ms",
                            "slide_interval_ms",
                          ].includes(key),
                      ),
                    )
                  : configuration
              }
              onChange={(next) =>
                setConfiguration((current) => ({ ...current, ...next }))
              }
            />
            {!Object.keys(configuration).length && sectionDefaults[type] && (
              <button
                type="button"
                onClick={() =>
                  setConfiguration(structuredClone(sectionDefaults[type]))
                }
              >
                Add section settings
              </button>
            )}
          </FormEditor>
        </Modal>
      )}
    </>
  );
}
