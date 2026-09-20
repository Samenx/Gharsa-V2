import {tr} from "../i18n";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
export function useData(path) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [version, reload] = useState(0),
    [loadedPath, setLoadedPath] = useState(null);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    if (!path) {setData(null);setLoading(false);setLoadedPath(path);return;}
    api(path)
      .then((d) => {
        if (live) setData(d);
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) {
          setLoading(false);
          setLoadedPath(path);
        }
      });
    return () => {
      live = false;
    };
  }, [path, version]);
  return {
    data,
    error,
    loading: loading || loadedPath !== path,
    reload: () => reload((x) => x + 1),
    setData,
  };
}
export const Loading = () => (
  <div className="state" role="status">
    <span className="spinner" />{tr("Growing something lovely…")}</div>
);
export const ErrorState = ({ message }) => (
  <div className="state error" role="alert">
    {message}
    <p>
      <Link to="/shop">{tr("Return to the shop")}</Link>
    </p>
  </div>
);
export const Empty = ({ children }) => <div className="state">{children}</div>;
export const Stars = ({ rating = 0 }) => (
  <span className="stars" aria-label={`${rating} out of 5 stars`}>
    {"★".repeat(Math.round(rating))}
    <span>{"☆".repeat(5 - Math.round(rating))}</span>
  </span>
);
export function Field({ label, error, ...props }) {
  return (
    <label className="field">
      <span>
        {tr(label)}
        {props.required ? " *" : ""}
      </span>
      {props.as === "textarea" ? (
        <textarea
          {...props}
          aria-label={props["aria-label"] || tr(label)}
          as={undefined}
        />
      ) : (
        <input {...props} aria-label={props["aria-label"] || tr(label)} />
      )}{" "}
      {error && <small className="error">{error}</small>}
    </label>
  );
}
export function Modal({ title, children, onClose }) {
  const dialogRef = useRef(null),
    closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = dialogRef.current;
    dialog.focus();
    const handleKey = (e) => {
      const dialogs = document.querySelectorAll('[role="dialog"]');
      if (dialogs[dialogs.length - 1] !== dialog) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
      }
      if (e.key === "Tab") {
        const targets = [
          ...dialog.querySelectorAll(
            'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
          ),
        ].filter((el) => el.getClientRects().length);
        if (!targets.length) {
          e.preventDefault();
          return;
        }
        const first = targets[0],
          last = targets[targets.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === dialog)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKey);
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = old;
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <button type="button" aria-label={tr("Close dialog")} onClick={onClose}>
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
export function SEO({ data }) {
  useEffect(() => {
    document.title =
      (data?.seo_title || data?.title || data?.name || tr("GHARSA")) +
      (data?.seo_title ? "" : " | GHARSA");
    for (const [name, content] of [
      [
        "description",
        data?.meta_description ||
          "Bring life home with GHARSA. Discover plants for your space, delivered with care across Jordan.",
      ],
      ["robots", data?.noindex ? "noindex,nofollow" : "index,follow"],
    ]) {
      let el = document.querySelector(`meta[name="${name}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.name = name;
        document.head.appendChild(el);
      }
      el.content = content;
    }
    let link = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = data?.canonical_url || location.href;
  }, [data]);
  return null;
}
export const Breadcrumb = ({ items }) => (
  <nav className="breadcrumb" aria-label={tr("Breadcrumb")}>
    <Link to="/">{tr("Home")}</Link>
    {items.map((x, i) => (
      <span key={i}>
        {" "}
        / {x.to ? <Link to={x.to}>{x.label}</Link> : x.label}
      </span>
    ))}
  </nav>
);
