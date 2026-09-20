import multer from 'multer';
import sharp from 'sharp';
import {mkdir,unlink} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import { query,pool,transaction } from '../config/db.js';
import { authenticated,permit,can } from '../middleware/auth.js';
import { email,text } from '../validators/index.js';
import { assert } from '../utils/errors.js';
import { deliveryEstimate } from '../services/v2.js';
const r=Router();
const evidenceDir=fileURLToPath(new URL('../../private-evidence/',import.meta.url));
const upload=multer({storage:multer.memoryStorage(),limits:{files:1,fileSize:5*1024*1024}});
r.post('/claim-evidence',authenticated,rateLimit({windowMs:3600000,limit:20}),upload.single('image'),async(req,res)=>{
 assert(req.file,'Choose a plant photo under 5 MB.');
 const id=randomUUID(),filename=id+'.webp';let buffer;
 try {buffer=await sharp(req.file.buffer,{limitInputPixels:20000000}).rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).webp({quality:80}).toBuffer();}catch{assert(false,'Choose a valid JPG, PNG or WebP image.');}
 await mkdir(evidenceDir,{recursive:true});
 const {writeFile}=await import('node:fs/promises');await writeFile(path.join(evidenceDir,filename),buffer,{mode:0o600});
 try{await query('INSERT INTO claim_evidence(id,user_id,path) VALUES($1,$2,$3)',[id,req.user.id,filename]);}catch(e){await unlink(path.join(evidenceDir,filename));throw e;}
 res.status(201).json({id});
});
r.get('/claim-evidence/:id',authenticated,async(req,res)=>{
 const id=z.uuid().parse(req.params.id);const row=(await query('SELECT * FROM claim_evidence WHERE id=$1',[id])).rows[0];assert(row&&(row.user_id===req.user.id||can(req.user,'guarantees.manage')),'Photo not found.',404);res.set('Cache-Control','private, no-store');res.sendFile(path.join(evidenceDir,row.path));
});
r.get('/v2/site',async(req,res)=> {
  const [announcements,footer,profiles,locations,returns,guarantees]=await Promise.all([
    query('SELECT * FROM announcements WHERE active AND (starts_at IS NULL OR starts_at<=now()) AND (ends_at IS NULL OR ends_at>=now()) ORDER BY display_order,id'),
    query('SELECT * FROM footer_columns WHERE active ORDER BY display_order,id'),query('SELECT * FROM climate_profiles WHERE active ORDER BY id'),query('SELECT * FROM suitable_locations WHERE active ORDER BY id'),query('SELECT * FROM return_policies WHERE active ORDER BY id DESC'),query('SELECT * FROM guarantee_policies WHERE active ORDER BY id DESC')]);
  res.json({announcements:announcements.rows,footer:footer.rows,profiles:profiles.rows,locations:locations.rows,returns:returns.rows,guarantees:guarantees.rows,google_enabled:false,email_enabled:false});
});
r.get('/faqs',async(req,res)=>res.json((await query('SELECT * FROM faqs WHERE active AND product_id IS NULL ORDER BY display_order,id')).rows));
r.get('/delivery-estimate',async(req,res)=>res.json(await deliveryEstimate(pool,String(req.query.city||'*').slice(0,100))));
const subscribeLimit=rateLimit({windowMs:3600000,limit:20,standardHeaders:'draft-8',legacyHeaders:false});
r.post('/newsletter',subscribeLimit,async(req,res)=> {
  const d=z.object({email,name:z.string().max(100).default(''),language:z.enum(['en','ar']).default('en'),consent:z.literal(true)}).parse(req.body);
  await query("INSERT INTO newsletter_subscribers(email,name,language,consented_at,unsubscribe_token) VALUES($1,$2,$3,now(),$4) ON CONFLICT(email) DO UPDATE SET name=excluded.name,language=excluded.language,consented_at=now(),status='subscribed'",[d.email,d.name,d.language,randomUUID()]);
  res.json({success:true,message:'Your preference is saved. Email delivery is currently disabled.'});
});
r.post('/newsletter/unsubscribe',async(req,res)=> { const token=z.uuid().parse(req.body.token);await query("UPDATE newsletter_subscribers SET status='unsubscribed' WHERE unsubscribe_token=$1",[token]);res.json({success:true}); });
r.post('/stock-notifications/unsubscribe',async(req,res)=>{const token=z.uuid().parse(req.body.token);await query("UPDATE stock_notifications SET status='unsubscribed' WHERE unsubscribe_token=$1",[token]);res.json({success:true});});
r.post('/stock-notifications',subscribeLimit,async(req,res)=> {
 const d=z.object({email,product_id:z.number().int().positive(),variation_id:z.number().int().positive().nullable().default(null),language:z.enum(['en','ar']).default('en')}).parse(req.body);
 const p=(await query('SELECT * FROM products WHERE id=$1 AND active',[d.product_id])).rows[0];assert(p,'Product not found.',404);
 if(d.variation_id) assert((await query('SELECT 1 FROM product_variations WHERE id=$1 AND product_id=$2 AND active',[d.variation_id,d.product_id])).rowCount,'Variation not found.',404);
 await query("INSERT INTO stock_notifications(email,product_id,variation_id,language,unsubscribe_token) VALUES($1,$2,$3,$4,$5) ON CONFLICT(lower(email),product_id,(COALESCE(variation_id,0))) DO UPDATE SET status='waiting',language=excluded.language",[d.email,d.product_id,d.variation_id,d.language,randomUUID()]);
 res.json({success:true,message:'Interest saved. Email alerts are currently disabled.'});
});
r.get('/service-requests',authenticated,async(req,res)=>res.json({returns:(await query('SELECT * FROM return_requests WHERE user_id=$1 ORDER BY id DESC',[req.user.id])).rows,guarantees:(await query('SELECT * FROM guarantee_claims WHERE user_id=$1 ORDER BY id DESC',[req.user.id])).rows}));
for(const type of ['returns','guarantees']) r.post('/service-requests/'+type,authenticated,async(req,res)=>{
 const d=z.object({order_item_id:z.number().int().positive(),reason:text,notes:z.string().max(4000).default(''),quantity:z.number().int().positive().default(1),photos:z.array(z.uuid()).max(5).default([])}).parse(req.body);
 const result=await transaction(async db=>{
 const item=(await db.query('SELECT i.*,o.status,o.completed_at FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.id=$1 AND o.user_id=$2 FOR UPDATE OF i',[d.order_item_id,req.user.id])).rows[0];
 assert(item,'Order item not found.',404);assert(item.status==='completed'&&item.completed_at,'Requests are available after delivery is completed.');
 const policy=type==='returns'?item.return_snapshot:item.guarantee_snapshot;
 assert(policy,'No applicable policy for this item.');
 assert(Date.now()-new Date(item.completed_at).getTime()<=(type==='returns'?policy.window_days:policy.duration_days)*86400000,'The request window has expired.');
 if(type==='returns') {assert(!policy.excluded_product_ids.includes(item.product_id),'This item is excluded by the return policy.');assert(d.quantity<=item.quantity,'Quantity exceeds purchased quantity.');return (await db.query('INSERT INTO return_requests(user_id,order_item_id,reason,notes,quantity,policy_snapshot) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[req.user.id,item.id,d.reason,d.notes,d.quantity,policy])).rows[0];}
 assert(!policy.evidence_required||d.photos.length>0,'This policy requires at least one plant photo.');
 if(d.photos.length) assert((await db.query('SELECT id FROM claim_evidence WHERE user_id=$1 AND id=ANY($2::uuid[])',[req.user.id,d.photos])).rowCount===new Set(d.photos).size,'Use photos uploaded by your account.');
 return (await db.query('INSERT INTO guarantee_claims(user_id,order_item_id,problem,policy_snapshot,photos) VALUES($1,$2,$3,$4,$5) RETURNING *',[req.user.id,item.id,d.reason+'\n'+d.notes,policy,JSON.stringify(d.photos)])).rows[0];
 });res.status(201).json(result);
});
export default r;
