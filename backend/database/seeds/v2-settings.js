import {pool,transaction} from '../../src/config/db.js';
await transaction(async db=>{
 const row=(await db.query("SELECT value FROM site_settings WHERE key='store' FOR UPDATE")).rows[0];if(!row||row.value.translations?.ar)return;
 row.value.translations={...row.value.translations,ar:{store_name:'غرسة',footer_text:'نباتات تضيف الحياة إلى مساحتك. اختر نباتك وابدأ رحلة خضراء معنا.',copyright:'غرسة — جميع الحقوق محفوظة.',footer_cta_title:'حياة أجمل تبدأ بنبتة',footer_cta_text:'اكتشف نباتات تناسب منزلك وحديقتك ومساحة عملك.'}};
 await db.query("UPDATE site_settings SET value=$1 WHERE key='store'",[row.value]);
});await pool.end();
