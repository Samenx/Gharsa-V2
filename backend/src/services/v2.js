import { query } from '../config/db.js';
export function deliveryDates(rule, now = new Date()) {
  if (!rule) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Amman',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
  const start = new Date(`${parts.year}-${parts.month}-${parts.day}T12:00:00Z`);
  const weekends = rule.weekend_days || [5];
  const advance = (date, days) => { const d=new Date(date); while(days>0) { d.setUTCDate(d.getUTCDate()+1); if(!weekends.includes(d.getUTCDay())) days--; } while(weekends.includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate()+1); return d; };
  const cutoff = rule.cutoff_hour !== null && Number(parts.hour)>=rule.cutoff_hour ? 1:0;
  const ready=advance(start,rule.processing_days+cutoff);
  return { earliest:advance(ready,rule.minimum_days).toISOString().slice(0,10),latest:advance(ready,rule.maximum_days).toISOString().slice(0,10),city:rule.city,rule:rule.name,guidance:true };
}
export async function deliveryEstimate(db,city='*',now=new Date()) {
  const aliases={'عمان':'Amman','عمّان':'Amman','اربد':'Irbid','إربد':'Irbid','الزرقاء':'Zarqa','العقبة':'Aqaba'};city=aliases[city.trim()]||city.trim();
  const rule=(await db.query("SELECT * FROM delivery_rules WHERE active AND (lower(city)=lower($1) OR lower(translations->'ar'->>'city')=lower($1) OR city='*') ORDER BY (city='*'),id DESC LIMIT 1",[city])).rows[0];
  return deliveryDates(rule,now);
}
export async function productV2(db,id) {
  const [variations,locations,calendar,faqs,bundles] = await Promise.all([
    db.query('SELECT * FROM product_variations WHERE product_id=$1 AND active ORDER BY display_order,id',[id]),
    db.query('SELECT l.* FROM suitable_locations l JOIN product_locations p ON p.location_id=l.id WHERE p.product_id=$1 AND l.active ORDER BY l.id',[id]),
    db.query('SELECT * FROM calendar_rules WHERE product_id=$1 AND active ORDER BY activity',[id]),
    db.query('SELECT * FROM faqs WHERE product_id=$1 AND active ORDER BY display_order,id',[id]),
    db.query("SELECT b.*,COALESCE((SELECT jsonb_agg(jsonb_build_object('id',i.id,'product_id',p.id,'variation_id',i.variation_id,'name',p.name,'slug',p.slug,'main_image',COALESCE(NULLIF(v.image,''),p.main_image),'regular_price',COALESCE(v.regular_price,p.regular_price),'sale_price',CASE WHEN v.id IS NOT NULL THEN v.sale_price WHEN p.on_sale THEN p.sale_price END,'quantity',i.quantity,'optional',i.optional) ORDER BY i.display_order) FROM bundle_items i JOIN products p ON p.id=i.product_id LEFT JOIN product_variations v ON v.id=i.variation_id WHERE i.bundle_id=b.id AND p.active),'[]') items FROM bundles b WHERE b.base_product_id=$1 AND b.active AND (starts_at IS NULL OR starts_at<=now()) AND (ends_at IS NULL OR ends_at>=now())",[id])
  ]);
  const guarantees=(await db.query("SELECT g.* FROM guarantee_policies g JOIN products p ON p.id=$1 WHERE g.active AND ((cardinality(g.product_ids)=0 AND cardinality(g.category_ids)=0) OR p.id=ANY(g.product_ids) OR p.category_id IN (WITH RECURSIVE tree AS (SELECT id FROM categories WHERE id=ANY(g.category_ids) UNION SELECT c.id FROM categories c JOIN tree t ON c.parent_id=t.id) SELECT id FROM tree) OR p.subcategory_id IN (WITH RECURSIVE tree AS (SELECT id FROM categories WHERE id=ANY(g.category_ids) UNION SELECT c.id FROM categories c JOIN tree t ON c.parent_id=t.id) SELECT id FROM tree)) ORDER BY g.id DESC",[id])).rows;
  return {guarantees,variations:variations.rows,locations:locations.rows,calendar:calendar.rows,faqs:faqs.rows,bundles:bundles.rows};
}
export function localized(value,lang) {
  if(Array.isArray(value)) return value.map(v=>localized(v,lang));
  if(value && typeof value==='object' && !(value instanceof Date)) {
    const {translations,category_translations,...base}=value;
    if(category_translations?.[lang]?.name)base.category_name=category_translations[lang].name;
    // Only translate display strings. IDs, prices, URLs, flags and role data remain authoritative.
    const allowed=new Set(['name','title','label','description','short_description','seo_title','meta_description','question','answer','group_name','content','conditions','exclusions','notes','subtitle','body','link_label','value','button','secondary_button','eyebrow','text','store_name','address','footer_text','copyright','store_notice','footer_cta_title','footer_cta_text']);
    for(const [k,v] of Object.entries(translations?.[lang]||{})) if(allowed.has(k)&&typeof v==='string') base[k]=v;
    return Object.fromEntries(Object.entries(base).map(([k,v])=>[k,localized(v,lang)]));
  }
  return value;
}
