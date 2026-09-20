const pending=new Map();
const cacheable=new Set(["/settings","/categories","/navigation","/v2/site"]);
const base = import.meta.env.VITE_API_URL || "/api";
export async function api(path, options = {}) {
  const key='gharsa_public_cache:'+ (localStorage.getItem('gharsa_language')||'en')+':'+path;
  const cache=(!options.method||options.method==='GET')&&cacheable.has(path);
  if(options.method && options.method!=='GET') for(const key of Object.keys(sessionStorage)) if(key.startsWith('gharsa_public_cache:'))sessionStorage.removeItem(key);
  if(cache){try{const saved=JSON.parse(sessionStorage.getItem(key)||'null');if(saved&&Date.now()-saved.time<15000)return saved.data;}catch{} if(pending.has(key))return pending.get(key);}
  const request=fetchApi(path,options);
  if(cache){pending.set(key,request);try{const data=await request;sessionStorage.setItem(key,JSON.stringify({time:Date.now(),data}));return data;}finally{pending.delete(key)}}
  return request;
}
async function fetchApi(path, options = {}) {
  const token = sessionStorage.getItem("gharsa_token");
  const response = await fetch(base + path, {
    ...options,
    headers: {
      "Accept-Language": localStorage.getItem("gharsa_language") || "en",
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    body:
      options.body instanceof FormData
        ? options.body
        : options.body === undefined
          ? undefined
          : JSON.stringify(options.body),
  });
  const data = await response
    .json()
    .catch(() => ({ error: "The server returned an invalid response." }));
  if (!response.ok) {
    const error = new Error(data.error || "Request failed");
    error.status = response.status;
    throw error;
  }
  return data;
}
export const money = (value) => `JOD ${Number(value || 0).toFixed(2)}`;
export const effectivePrice = (p) =>
  p.on_sale && p.sale_price !== null
    ? Number(p.sale_price)
    : Number(p.regular_price);

export const lineKey = i=>`${i.product_id||i.id}:${i.variation_id||0}:${i.bundle_id||0}`;
