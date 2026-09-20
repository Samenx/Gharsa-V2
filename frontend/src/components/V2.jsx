import { tr } from "../i18n";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Leaf,
  Sun,
  Droplets,
  Heart,
  Scale,
  MapPin,
  Thermometer,
  House,
  Truck,
  ShieldCheck,
} from "lucide-react";
import { api } from "../api/client";
import { useStore } from "../context/Store";
import { useLanguage } from "../context/Language";
import { useData, Loading, ErrorState, SEO } from "./UI";
export function LanguageSwitch() {
  const { language, setLanguage } = useLanguage();
  return (
    <button
      className="language-switch"
      aria-label={language === "en" ? "العربية" : "English"}
      onClick={() => setLanguage(language === "en" ? "ar" : "en")}
    >
      <span className={language === "en" ? "selected" : ""}>EN</span>
      <span aria-hidden="true">|</span>
      <span lang="ar" className={language === "ar" ? "selected" : ""}>
        العربية
      </span>
    </button>
  );
}
export function Announcements() {
  const { data } = useData("/v2/site");
  const [hidden, setHidden] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("gharsa_announcements") || "[]");
    } catch {
      return [];
    }
  });
  return data?.announcements
    .filter((a) => !hidden.includes(a.id))
    .map((a) => (
      <div className="v2-announcement" key={a.id}>
        <Leaf size={18} className="announcement-leaf" aria-hidden="true" />
        <span>{a.title}</span>
        {a.url && <Link to={a.url}>{a.link_label || a.title} →</Link>}
        {a.dismissible && (
          <button
            aria-label="Dismiss announcement"
            onClick={() => {
              const next = [...hidden, a.id];
              setHidden(next);
              sessionStorage.setItem(
                "gharsa_announcements",
                JSON.stringify(next),
              );
            }}
          >
            ×
          </button>
        )}
      </div>
    ));
}
export function Newsletter({ title, description } = {}) {
  const { t, language } = useLanguage();
  const [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <section className="newsletter">
      <div>
        <span className="eyebrow">GHARSA JOURNAL</span>
        <h2>
          {title || t("Let good things grow.", "دع الأشياء الجميلة تنمو.")}
        </h2>
        <p>
          {description ||
            t(
              "Save your interest in plant stories and store updates. Email delivery is not enabled yet.",
              "سجّل اهتمامك بقصص النباتات وأخبار المتجر. إرسال البريد غير مفعّل بعد.",
            )}
        </p>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const form = e.currentTarget;
          try {
            await api("/newsletter", {
              method: "POST",
              body: {
                ...Object.fromEntries(new FormData(form)),
                consent: true,
                language,
              },
            });
            setStatus(t("Your preference has been saved.", "تم حفظ تفضيلاتك."));
            form.reset();
          } catch (e) {
            setStatus(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          {t("Name (optional)", "الاسم (اختياري)")}
          <input name="name" maxLength={100} />
        </label>
        <label>
          {t("Newsletter email", "بريد النشرة الإخبارية")}
          <input name="email" type="email" required maxLength={254} />
        </label>
        <label className="check">
          <input type="checkbox" required />
          {t(
            "I agree to receive store news when email is enabled.",
            "أوافق على تلقي أخبار المتجر عند تفعيل البريد.",
          )}
        </label>
        <button className="button" disabled={busy}>
          {t("Subscribe", "اشترك")}
        </button>
        {status && <p role="status">{status}</p>}
      </form>
    </section>
  );
}
export function FooterColumns() {
  const { data } = useData("/v2/site");
  return (
    <div className="v2-footer-columns">
      {data?.footer.map((c) => (
        <div key={c.id}>
          <h3>{c.title}</h3>
          {c.links.map((l, i) => (
            <Link key={i} to={l.url}>
              {tr(l.label)}
            </Link>
          ))}
        </div>
      ))}
    </div>
  );
}
export function FAQList({ items = [] }) {
  return (
    <div className="faq-list">
      {items.map((f) => (
        <details key={f.id}>
          <summary>
            {f.question}
            <span>+</span>
          </summary>
          <p>{f.answer}</p>
        </details>
      ))}
    </div>
  );
}
export function FAQPage() {
  const { data, error, loading } = useData("/faqs");
  const { t } = useLanguage();
  const [search, setSearch] = useState(""),
    [group, setGroup] = useState("");
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;
  return (
    <div className="container v2-page">
      <SEO
        data={{ title: t("Frequently asked questions", "الأسئلة الشائعة") }}
      />
      <span className="eyebrow">WE’RE HERE TO HELP</span>
      <h1>
        {t(
          "A little help for your growing journey.",
          "نساعدك في رحلتك مع النباتات.",
        )}
      </h1>
      <input
        className="faq-search"
        aria-label={t("Search questions", "ابحث في الأسئلة")}
        placeholder={t("Search questions…", "ابحث في الأسئلة…")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="v2-tabs">
        <button className={!group ? "active" : ""} onClick={() => setGroup("")}>
          {t("All questions", "كل الأسئلة")}
        </button>
        {[...new Set(data.map((f) => f.group_name))].map((g) => (
          <button
            key={g}
            className={group === g ? "active" : ""}
            onClick={() => setGroup(g)}
          >
            {tr(g)}
          </button>
        ))}
      </div>
      <FAQList
        items={data.filter(
          (f) =>
            (!group || f.group_name === group) &&
            `${f.question} ${f.answer}`
              .toLowerCase()
              .includes(search.toLowerCase()),
        )}
      />
    </div>
  );
}
export function DeliveryEstimate({ city: providedCity }) {
  const { t } = useLanguage();
  const [chosenCity, setCity] = useState("Amman");
  const city = providedCity === undefined ? chosenCity : providedCity;
  const { data } = useData(
    "/delivery-estimate?city=" + encodeURIComponent(city || "*"),
  );
  return (
    <div className="delivery-estimate">
      <Truck size={21} />
      <div>
        <strong>{t("Estimated arrival", "التوصيل المتوقع")}</strong>
        {providedCity === undefined ? (
          <input
            aria-label={t("Delivery city", "مدينة التوصيل")}
            value={city}
            onChange={(e) => setCity(e.target.value)}
            maxLength={100}
          />
        ) : (
          <span> · {city}</span>
        )}
        {data ? (
          <p>
            {data.earliest} — {data.latest}
            <small>
              {t(
                "Estimated dates, excluding non-delivery days.",
                "مواعيد تقديرية باستثناء أيام توقف التوصيل.",
              )}
            </small>
          </p>
        ) : (
          <p>
            {t(
              "Contact us for delivery timing.",
              "تواصل معنا لمعرفة موعد التوصيل.",
            )}
          </p>
        )}
      </div>
    </div>
  );
}
export function PolicyPage({ type }) {
  const { data, error, loading } = useData("/v2/site");
  const { t } = useLanguage();
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;
  const policies = type === "returns" ? data.returns : data.guarantees;
  return (
    <div className="container v2-page">
      <SEO
        data={{
          title:
            type === "returns"
              ? t("Returns", "الإرجاع")
              : type === "delivery"
                ? t("Delivery", "التوصيل")
                : t("Plant guarantee", "ضمان النباتات"),
        }}
      />
      <h1>
        {type === "returns"
          ? t("Returns & exchanges", "الإرجاع والاستبدال")
          : type === "delivery"
            ? t("Delivered with care", "توصيل بعناية")
            : t("Growing with confidence", "ازرع بثقة")}
      </h1>
      {type === "delivery" ? (
        <DeliveryEstimate />
      ) : policies.length ? (
        policies.map((p) => (
          <article className="policy-card" key={p.id}>
            <ShieldCheck />
            <h2>{p.title}</h2>
            <p>{p.content || p.conditions}</p>
            {p.content && <p>{p.conditions}</p>}
            {p.exclusions && <p>{p.exclusions}</p>}
            <p>
              {p.window_days || p.duration_days}{" "}
              {t("days from completed delivery.", "يوماً من اكتمال التوصيل.")}
            </p>
          </article>
        ))
      ) : (
        <p>
          {t(
            "The store is preparing its policy. Please contact us before ordering for the applicable terms.",
            "يعمل المتجر على إعداد السياسة. تواصل معنا قبل الطلب لمعرفة الشروط المطبقة.",
          )}
        </p>
      )}
      <Link to="/contact">{t("Contact the store", "تواصل مع المتجر")} →</Link>
    </div>
  );
}
const normalized = (attribute) => `${attribute.attribute_key || ""} ${attribute.name || ""}`.toLowerCase();
const isInternalAttribute = (attribute) => /price\s*(note|basis|checked)|care\s*sources?|evidence\s*level|catalogue\s*note|admin\s*note/.test(normalized(attribute));
const findAttribute = (attributes, pattern) => attributes.find((attribute) => pattern.test(normalized(attribute)));

export function ProductCare({ product: p }) {
  const { t } = useLanguage();
  const attributes = (p.attributes || []).filter((attribute) => !isInternalAttribute(attribute));
  const light = findAttribute(attributes, /light|sun|exposure/);
  const watering = findAttribute(attributes, /water|moisture/);
  const difficulty = findAttribute(attributes, /difficulty|care level/);
  const temperature = findAttribute(attributes, /temperature|temp/);
  const setting = findAttribute(attributes, /growing.?setting|setting|indoor|outdoor/);
  const place = p.locations?.length
    ? { value: p.locations.map((location) => location.name).join(" / ") }
    : findAttribute(attributes, /best.?place|placement|location/);
  const items = [
    [place, MapPin, t("Best Place", "أفضل مكان")],
    [light, Sun, t("Light", "الإضاءة")],
    [watering, Droplets, t("Watering", "الري")],
    [difficulty, Leaf, t("Care Level", "مستوى العناية")],
    [temperature, Thermometer, t("Temperature", "الحرارة")],
    [setting, House, t("Growing Setting", "بيئة النمو")],
  ].filter(([attribute]) => attribute?.value);
  if (!items.length) return null;
  return <section className="quick-plant-care" aria-label={t("Quick Plant Care", "العناية السريعة بالنبات")}>
    <h2>{t("Quick Plant Care", "العناية السريعة بالنبات")}</h2>
    <div>{items.map(([attribute, Icon, label]) => <article key={label}>
      <Icon size={19}/><div><h3>{label}</h3><p>{attribute.value}</p></div>
    </article>)}</div>
  </section>;
}

function PlantDetailGroups({ product: p, t }) {
  const attributes = (p.attributes || []).filter((attribute) => !isInternalAttribute(attribute));
  const usedInQuickCare = /light|sun|exposure|water|moisture|difficulty|care level|temperature|temp|growing.?setting|setting|indoor|outdoor|best.?place|placement|location/;
  const groups = [
    [t("Care Details", "تفاصيل العناية"), /soil|drainage|humidity|drought|seasonal/, attributes.filter((a) => /soil|drainage|humidity|drought|seasonal/.test(normalized(a)))],
    [t("Plant Information", "معلومات النبات"), /scientific|propagation|flowering|fruiting/, attributes.filter((a) => /scientific|propagation|flowering|fruiting/.test(normalized(a)))],
    [t("Health & Safety", "الصحة والسلامة"), /safety|toxic|pet|pest|disease/, attributes.filter((a) => /safety|toxic|pet|pest|disease/.test(normalized(a)))],
    [t("What You Receive", "ما الذي ستحصل عليه"), /what.*receive|included|receive/, attributes.filter((a) => /what.*receive|included|receive/.test(normalized(a)))],
  ];
  const assigned = groups.flatMap(([, , items]) => items);
  const other = attributes.filter((a) => !assigned.includes(a) && !usedInQuickCare.test(normalized(a)));
  if (other.length) groups[0][2].push(...other);
  return <div className="plant-detail-accordion">
    {groups.filter(([, , items]) => items.length).map(([title, , items], index) => <details key={title} open={index === 0}>
      <summary>{title}<span aria-hidden="true">+</span></summary>
      <dl>{items.map((attribute, itemIndex) => <div key={attribute.id || itemIndex}><dt>{attribute.name}</dt><dd>{attribute.value}</dd></div>)}</dl>
    </details>)}
  </div>;
}

export function ProductExtras({ product: p }) {
  const { t, language } = useLanguage();
  const { data: site } = useData("/v2/site");
  const [region, setRegion] = useState(""),
    [locationStatus, setLocationStatus] = useState("");
  const applicable =
    p.calendar?.filter(
      (r) => !r.climate_profile_id || String(r.climate_profile_id) === region,
    ) || [];
  const rules = [
    ...new Map(
      applicable
        .sort(
          (a, b) =>
            Number(!!a.climate_profile_id) - Number(!!b.climate_profile_id),
        )
        .map((r) => [r.activity, r]),
    ).values(),
  ];
  const months = Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(language, { month: "short" }).format(
      new Date(2026, i, 1),
    ),
  );
  return (
    <>
      {p.attributes?.length > 0 && (
        <section className="plant-details section">
          <h2>{t("More About This Plant", "المزيد عن هذا النبات")}</h2>
          <PlantDetailGroups product={p} t={t}/>
        </section>
      )}
      {p.calendar?.length > 0 && (
        <section className="section plant-calendar">
          <h2>{t("A year of growing", "عام من النمو")}</h2>
          <label>
            {t("Your growing region", "منطقة الزراعة")}
            <select value={region} onChange={(e) => setRegion(e.target.value)}>
              <option value="">{t("General guidance", "إرشادات عامة")}</option>
              {site?.profiles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="text-button"
            onClick={() => {
              if (!navigator.geolocation)
                return setLocationStatus(
                  t("Location is unavailable.", "الموقع غير متاح."),
                );
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  const nearest = site?.profiles
                    .filter((c) => c.latitude !== null && c.longitude !== null)
                    .sort(
                      (a, b) =>
                        (a.latitude - pos.coords.latitude) ** 2 +
                        (a.longitude - pos.coords.longitude) ** 2 -
                        ((b.latitude - pos.coords.latitude) ** 2 +
                          (b.longitude - pos.coords.longitude) ** 2),
                    )[0];
                  if (nearest) setRegion(String(nearest.id));
                },
                () =>
                  setLocationStatus(
                    t("Choose your region manually.", "اختر منطقتك يدوياً."),
                  ),
              );
            }}
          >
            {t("Use my location", "استخدم موقعي")}
          </button>
          {locationStatus && <p role="status">{locationStatus}</p>}
          <div className="calendar-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t("Activity", "النشاط")}</th>
                  {months.map((m, i) => (
                    <th key={i}>{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id}>
                    <th>
                      {t(
                        r.activity,
                        {
                          planting: "الزراعة",
                          flowering: "الإزهار",
                          pruning: "التقليم",
                          repotting: "تغيير الوعاء",
                        }[r.activity],
                      )}
                    </th>
                    {months.map((m, i) => (
                      <td
                        key={i}
                        className={r.months.includes(i + 1) ? "growing" : ""}
                      >
                        <span className="sr-only">
                          {r.months.includes(i + 1) ? "Recommended" : "—"}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {region && site?.profiles.find((c) => String(c.id) === region) && (
            <p>
              {site.profiles.find((c) => String(c.id) === region).description}
            </p>
          )}
          {!rules.some((r) => r.climate_profile_id) && region && (
            <p>
              {t(
                "No region-specific rule is published; showing general guidance.",
                "لا توجد إرشادات منشورة لهذه المنطقة؛ نعرض الإرشادات العامة.",
              )}
            </p>
          )}
          {rules.map((r) => r.notes && <p key={r.id}>{r.notes}</p>)}
          <small>
            {t(
              "Seasonal guidance only. Local weather, indoor conditions and plant maturity can change timing.",
              "إرشادات موسمية فقط. قد تختلف المواعيد بحسب الطقس وظروف المكان وعمر النبات.",
            )}
          </small>
        </section>
      )}
      {p.faqs?.length > 0 && (
        <section className="section">
          <h2>{t("Your questions, answered", "إجابات عن أسئلتك")}</h2>
          <FAQList items={p.faqs} />
        </section>
      )}
    </>
  );
}
export function StockInterest({ productId, variationId = null }) {
  const { t, language } = useLanguage();
  const [status, setStatus] = useState("");
  return (
    <form
      className="stock-interest"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          const d = await api("/stock-notifications", {
            method: "POST",
            body: {
              email: new FormData(e.currentTarget).get("email"),
              product_id: productId,
              variation_id: variationId,
              language,
            },
          });
          setStatus(d.message);
        } catch (e) {
          setStatus(e.message);
        }
      }}
    >
      <label>
        {t("Interested when it returns?", "مهتم عند توفره مجدداً؟")}
        <input
          name="email"
          type="email"
          required
          placeholder={t("Your email", "بريدك الإلكتروني")}
        />
      </label>
      <button className="button secondary">
        {t("Save interest", "سجّل اهتمامي")}
      </button>
      <small>
        {t(
          "Email alerts are currently disabled.",
          "تنبيهات البريد غير مفعّلة حالياً.",
        )}
      </small>
      {status && <p role="status">{status}</p>}
    </form>
  );
}
