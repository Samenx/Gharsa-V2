import { tr } from "../i18n";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck,
  Truck,
  PackageCheck,
  Headphones,
  Leaf,
} from "lucide-react";
import { useStore } from "../context/Store";
import { useData, Loading, ErrorState, Stars, Field } from "./UI";
import { ProductGrid } from "./Products";
import { api } from "../api/client";
function Slider({ section: s }) {
  const slides = s.configuration.slides || [
    { image: s.configuration.image, url: s.configuration.url },
  ];
  const animation = ["fade", "slide", "zoom", "none"].includes(
    s.configuration.animation_style,
  )
    ? s.configuration.animation_style
    : "fade";
  const bounded = (value, fallback, min, max) =>
    Number.isFinite(Number(value)) && value !== undefined
      ? Math.min(max, Math.max(min, Number(value)))
      : fallback;
  const duration = bounded(s.configuration.transition_ms, 900, 100, 3000);
  const interval = Math.max(
    duration + 500,
    bounded(s.configuration.slide_interval_ms, 6000, 2000, 30000),
  );
  const [index, setIndex] = useState(0),
    [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || slides.length < 2) return;
    const t = setInterval(
      () => setIndex((n) => (n + 1) % slides.length),
      interval,
    );
    return () => clearInterval(t);
  }, [slides.length, paused, interval]);
  const activeIndex = slides.length ? index % slides.length : 0;
  return (
    <section
      className="hero-slider"
      data-animation={animation}
      style={{ "--slide-duration": `${duration}ms` }}
      aria-label={s.title || "GHARSA plant collection"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
    >
      <div className="hero-slide-stack">
        {slides.map((slide, i) => (
          <div
            key={i}
            className={"hero-slide " + (i === activeIndex ? "is-active" : "")}
            aria-hidden={i !== activeIndex}
            inert={i !== activeIndex}
          >
            {slide.title ? (
              <div className="hero-editorial">
                <div className="hero-editorial-copy">
                  <span className="eyebrow">
                    {slide.eyebrow || "GHARSA · GROW YOUR SPACE"}
                  </span>
                  <h1>{slide.title}</h1>
                  <p>{slide.text}</p>
                  <div>
                    <Link className="button" to={slide.url || "/shop"}>
                      {slide.button || tr("Shop Now")}
                    </Link>
                    {slide.secondary_url && (
                      <Link className="hero-secondary" to={slide.secondary_url}>
                        {slide.secondary_button || tr("Find your plant")} →
                      </Link>
                    )}
                  </div>
                </div>
                <picture>
                  {slide.mobile_image && (
                    <source
                      media="(max-width:780px)"
                      srcSet={slide.mobile_image}
                    />
                  )}
                  <img
                    src={slide.image}
                    alt={slide.alt || slide.title}
                    fetchPriority={i === 0 ? "high" : "auto"}
                    decoding="async"
                  />
                </picture>
              </div>
            ) : (
              <Link to={slide.url || "/shop"}>
                <picture>
                  {slide.mobile_image && (
                    <source
                      media="(max-width:780px)"
                      srcSet={slide.mobile_image}
                    />
                  )}
                  <img
                    src={slide.image}
                    alt={slide.alt || s.title || "GHARSA plant collection"}
                    fetchPriority={i === 0 ? "high" : "auto"}
                    decoding="async"
                  />
                </picture>
              </Link>
            )}
          </div>
        ))}
      </div>
      {slides.length > 1 && (
        <div className="slider-controls">
          {slides.map((_, i) => (
            <button
              key={i}
              className={activeIndex === i ? "active" : ""}
              aria-current={activeIndex === i ? "true" : undefined}
              aria-label={"Go to slide " + (i + 1)}
              onClick={() => setIndex(i)}
            />
          ))}
          <button
            className="pause"
            onClick={() => setPaused(!paused)}
            aria-label={paused ? "Play slideshow" : "Pause slideshow"}
          >
            {paused ? "▶" : "Ⅱ"}
          </button>
        </div>
      )}
    </section>
  );
}
function ProductsSection({ section: s }) {
  const c = s.configuration;
  const source =
    c.source ||
    {
      popular_products: "popular",
      featured_products: "featured",
      sale_products: "sale",
    }[s.section_type] ||
    "";
  const { data, error, loading } = useData(
    "/products?" +
      new URLSearchParams({
        source: c.product_ids?.length ? "" : source,
        limit: c.limit || 4,
        ...(c.product_ids?.length ? { ids: c.product_ids.join(",") } : {}),
      }),
  );
  return (
    <section className="section container">
      <h2>{s.title}</h2>
      {s.subtitle && <p className="section-subtitle">{s.subtitle}</p>}
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <ProductGrid products={data.items} config={c} />
      )}
    </section>
  );
}
function Testimonials({ section: s }) {
  const { data } = useData("/testimonials");
  return (
    <section className="section testimonials">
      <div className="container">
        <div className="testimonial-heading">
          <h2>{s.title}</h2>
          <p className="section-subtitle">{s.subtitle}</p>
        </div>
        <div className="testimonial-grid">
          {data?.map((t) => (
            <figure key={t.id}>
              <Stars rating={t.rating} />
              <blockquote>{t.body}</blockquote>
              <figcaption>
                <img src={t.image} alt="" />
                <strong>{t.name}</strong>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
export function ContactForm() {
  const { notify } = useStore();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      className="contact-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        setBusy(true);
        setError("");
        try {
          await api("/contact", {
            method: "POST",
            body: Object.fromEntries(new FormData(form)),
          });
          notify("Thank you! Your message has been sent.");
          form.reset();
        } catch (e) {
          setError(e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label={tr("Name")} name="name" required />
      <Field label={tr("Email")} name="email" type="email" required />
      <Field label={tr("Phone")} name="phone" type="tel" required />
      <Field
        label={tr("Message")}
        name="message"
        as="textarea"
        minLength={5}
        required
      />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="button" disabled={busy}>
        {busy ? tr("Sending…") : "Submit"}
      </button>
    </form>
  );
}
export default function Section({ section: s }) {
  const { categories, settings } = useStore();
  const c = s.configuration || {};
  if (["hero", "image_slider"].includes(s.section_type))
    return <Slider section={s} />;
  if (
    [
      "product_grid",
      "popular_products",
      "featured_products",
      "sale_products",
    ].includes(s.section_type)
  )
    return <ProductsSection section={s} />;
  if (s.section_type === "testimonials") return <Testimonials section={s} />;
  if (s.section_type === "category_grid") {
    const list = c.category_ids?.length
      ? c.category_ids
          .map((id) => categories.find((x) => x.id === id))
          .filter(Boolean)
      : categories.filter((x) => !x.parent_id);
    return (
      <section className="section container">
        <h2>{s.title}</h2>
        <div className="category-grid">
          {list.map((cat) => (
            <Link
              key={cat.id}
              className="category-card"
              to={"/shop?category=" + cat.slug}
            >
              <img loading="lazy" src={cat.image} alt={cat.name} />
              <h3>{cat.name}</h3>
            </Link>
          ))}
        </div>
      </section>
    );
  }
  if (s.section_type === "features") {
    const icons = [ShieldCheck, Truck, PackageCheck, Headphones, Leaf];
    return (
      <section className={"container features " + (c.large ? "large" : "")}>
        {s.title && <h2>{s.title}</h2>}
        <div>
          {c.items?.map((item, i) => {
            const Icon = icons[i % icons.length];
            return (
              <article key={i}>
                <Icon />
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            );
          })}
        </div>
      </section>
    );
  }
  if (s.section_type === "cta_banner")
    return (
      <section
        className="promo"
        style={
          c.image
            ? {
                backgroundImage: `linear-gradient(#00121988,#00121988),url("${c.image}")`,
              }
            : undefined
        }
      >
        <div className="container">
          <h2>{s.title}</h2>
          <p>{s.subtitle || s.content}</p>
          <Link className="button" to={c.url || "/shop"}>
            {c.button || tr("Shop Now")}
          </Link>
        </div>
      </section>
    );
  if (s.section_type === "image_text")
    return (
      <section
        className={
          "section container image-text " + (c.reverse ? "reverse" : "")
        }
      >
        <img src={c.image} alt={c.alt || s.title} />
        <div>
          <p className="eyebrow">{s.subtitle}</p>
          <h2>{s.title}</h2>
          <div
            className="rich-text"
            dangerouslySetInnerHTML={{ __html: s.content }}
          />
          {c.button && (
            <Link className="button" to={c.url || "/shop"}>
              {c.button}
            </Link>
          )}
        </div>
      </section>
    );
  if (s.section_type === "contact_form")
    return (
      <section className="section container contact-layout">
        <div>
          <p className="eyebrow">{s.subtitle}</p>
          <h2>{s.title}</h2>
          <h3>{tr("Phone")}</h3>
          <a href={"tel:" + settings.phone}>{settings.phone}</a>
          <h3>{tr("Email")}</h3>
          <a href={"mailto:" + settings.email}>{settings.email}</a>
          <h3>{tr("Address")}</h3>
          <p>{settings.address}</p>
        </div>
        <ContactForm />
      </section>
    );
  if (s.section_type === "gallery")
    return (
      <section className="section container">
        <h2>{s.title}</h2>
        <div className="category-grid">
          {c.images?.map((img, i) => (
            <img key={i} src={img.image || img.path} alt={img.alt || ""} />
          ))}
        </div>
      </section>
    );
  return (
    <section className="section container text-section">
      <h2>{s.title}</h2>
      {s.subtitle && <p className="section-subtitle">{s.subtitle}</p>}
      <div
        className="rich-text"
        dangerouslySetInnerHTML={{ __html: s.content }}
      />
    </section>
  );
}
