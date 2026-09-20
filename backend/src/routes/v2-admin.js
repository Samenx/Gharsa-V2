import {Router} from 'express';
import {z} from 'zod';
import {query,transaction} from '../config/db.js';
import {permit} from '../middleware/auth.js';
import {audit} from '../services/admin.js';
import {assert} from '../utils/errors.js';
const r=Router();
const definitions={return_requests:{permission:'returns.manage',fields:['status','response'],statuses:['pending','information_requested','approved','rejected','received','resolved']},guarantee_claims:{permission:'guarantees.manage',fields:['status','response','resolution'],statuses:['pending','information_requested','approved','rejected','resolved']},newsletter_subscribers:{permission:'newsletter.manage'},stock_notifications:{permission:'notifications.manage'}};
for(const [table,d] of Object.entries(definitions)) {
 r.get('/v2/'+table,permit(d.permission),async(req,res)=>res.json((await query(`SELECT * FROM ${table} ORDER BY id DESC LIMIT 1000`)).rows));
 if(d.fields)r.put('/v2/'+table+'/:id',permit(d.permission),async(req,res)=>{
 const schema=z.object({status:z.enum(d.statuses),response:z.string().max(5000).default(''),...(d.fields.includes('resolution')?{resolution:z.string().max(2000).default('')}:{})});const data=schema.parse(req.body);
 res.json(await transaction(async db=>{const old=(await db.query(`SELECT * FROM ${table} WHERE id=$1 FOR UPDATE`,[req.params.id])).rows[0];assert(old,'Request not found.',404);assert(!['resolved','rejected'].includes(old.status)||old.status===data.status,'Closed requests cannot be reopened.');
 const result=(await db.query(`UPDATE ${table} SET ${d.fields.map((f,i)=>`${f}=$${i+1}`).join(',')},updated_at=now() WHERE id=$${d.fields.length+1} RETURNING *`,[...d.fields.map(f=>data[f]),old.id])).rows[0];await audit(db,req.user,'review',table,old.id,data.status);return result;}));
 });
}
r.put('/v2/newsletter_subscribers/:id',permit('newsletter.manage'),async(req,res)=>{
 const status=z.literal('unsubscribed').parse(req.body.status);
 await transaction(async db=>{const result=await db.query('UPDATE newsletter_subscribers SET status=$1 WHERE id=$2 RETURNING id',[status,req.params.id]);assert(result.rowCount,'Subscriber not found.',404);await audit(db,req.user,'unsubscribe','newsletter_subscribers',req.params.id,'Unsubscribed by store administrator');});res.json({success:true});
});
r.get('/v2/newsletter-export' ,permit('newsletter.manage'),async(req,res)=>{
 const rows=(await query('SELECT email,name,language,status,consented_at FROM newsletter_subscribers ORDER BY id')).rows;
 const cell=v=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';
 res.json({filename:'gharsa-newsletter.csv',csv:['email,name,language,status,consented_at',...rows.map(row=>Object.values(row).map(cell).join(','))].join('\r\n')});
});
export default r;
