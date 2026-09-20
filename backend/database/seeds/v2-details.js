import {transaction,pool} from '../../src/config/db.js';
await transaction(async db=>{
 if((await db.query("SELECT 1 FROM site_settings WHERE key='v2_details_seeded'")).rowCount)return;
 // These descriptions summarize the existing catalogue; unknown measurements are not invented.
 const care={
 'bougainvillea':['Full sun','Let soil partially dry','شمس كاملة','اترك التربة تجف جزئياً'],
 'bougainvillea-flowering-plant':['Full sun','Avoid excessive watering','شمس كاملة','تجنب الإفراط في الري'],
 'geranium':['Sunny location','Water as soil begins to dry','مكان مشمس','اسقِ عند بداية جفاف التربة'],
 'orange-tree':['Full sun','Consistent watering during active growth','شمس كاملة','ري منتظم خلال النمو'],
 'lavender':['Full sun','Avoid excessive watering','شمس كاملة','تجنب الإفراط في الري'],
 'snake-plant':['Adaptable indoor light','Let soil dry before watering','إضاءة داخلية متنوعة','اترك التربة تجف قبل الري'],
 'marigold':['Full sun','Check soil moisture before watering','شمس كاملة','تحقق من رطوبة التربة قبل الري'],
 'phalaenopsis-orchid':['Bright indirect light','Do not leave roots standing in water','ضوء ساطع غير مباشر','لا تترك الجذور في الماء'],
 'jasmine':['Plenty of sunlight','Regular watering during active growth','ضوء شمس وفير','ري منتظم خلال النمو'],
 'red-rose-plant':['Sunny location','Regular watering, especially in hot weather','مكان مشمس','ري منتظم خصوصاً في الحر'],
 'star-jasmine':['Plenty of sunlight','Regular watering in hot, dry periods','ضوء شمس وفير','ري منتظم في الفترات الحارة والجافة'],
 'hanging-pothos':['Bright indirect light','Water when upper soil dries','ضوء ساطع غير مباشر','اسقِ عندما يجف سطح التربة'],
 'string-of-hearts':['Bright indirect light','Let soil dry between watering','ضوء ساطع غير مباشر','اترك التربة تجف بين مرات الري'],
 'heartleaf-philodendron':['Bright indirect light; tolerates moderate lower light','Let soil dry slightly between watering','ضوء ساطع غير مباشر ويتحمل الإضاءة المتوسطة','اترك التربة تجف قليلاً بين مرات الري'],
 'golden-pothos':['Bright indirect light; tolerates lower light','Water when top soil dries','ضوء ساطع غير مباشر ويتحمل الإضاءة المنخفضة','اسقِ عندما يجف سطح التربة']};
 for(const p of (await db.query('SELECT id,slug FROM products')).rows){const d=care[p.slug];if(!d)continue;if((await db.query('SELECT 1 FROM product_attributes WHERE product_id=$1 LIMIT 1',[p.id])).rowCount)continue;
 for(const [name,value,key,arabicName,arabicValue] of [['Light',d[0],'light','الإضاءة',d[2]],['Watering',d[1],'watering','الري',d[3]]]) await db.query('INSERT INTO product_attributes(product_id,name,value,attribute_key,attribute_group,translations) VALUES($1,$2,$3,$4,$5,$6)',[p.id,name,value,key,'care',{ar:{name:arabicName,value:arabicValue}}]);
 if(/snake|pothos|philodendron/.test(p.slug))await db.query("INSERT INTO product_attributes(product_id,name,value,attribute_key,attribute_group,translations) VALUES($1,'Care difficulty','Easy care','difficulty','care',$2)",[p.id,{ar:{name:'مستوى العناية',value:'سهل العناية'}}]);
 }
 const pothos=(await db.query("SELECT id FROM products WHERE slug='golden-pothos'")).rows[0];
 if(pothos)await db.query("INSERT INTO calendar_rules(product_id,activity,months,notes,translations) VALUES($1,'repotting','{3,4,5}',$2,$3) ON CONFLICT DO NOTHING",[pothos.id,'General spring guidance: check for crowded roots and repot only when needed, as active growth begins. These are not locally calibrated city dates.',{ar:{notes:'إرشادات عامة للربيع: تحقق من ازدحام الجذور وغيّر الوعاء عند الحاجة مع بدء النمو. هذه ليست مواعيد محددة حسب المدينة.'}}]);
 const sectionText={
 'Our Categories':{title:'فئات النباتات'},'Popular Products':{title:'النباتات الأكثر طلباً'},'What Our Customers Say':{title:'آراء عملائنا',subtitle:'تعرّف على تجارب عملائنا مع غرسة.'},
 'Flash Sale: Up to 50% Off On Select Items!':{title:'عروض على نباتات مختارة',subtitle:'اكتشف أسعار العروض المتاحة على مجموعة من نباتاتنا.'},
 'We are Passionate About Our Work':{title:'نحب ما نزرع',subtitle:'نختار نباتاتنا بعناية لترافقك في مساحتك.',content:'<p>في غرسة، نؤمن أن النبات بداية صغيرة تنمو مع الوقت وتضيف حياة ولوناً إلى منزلك.</p><p>نسهّل عليك اكتشاف متعة الزراعة والعناية بنباتك، من أول ورقة إلى أول غصن جديد.</p>'},
 'Our Mission':{title:'رسالتنا',content:'<p>نقرّب الناس من الطبيعة بتوفير نباتات يسهل اكتشافها واختيارها، مع إرشادات تساعدها على النمو.</p><p>نريد أن نملأ المساحات بالحياة واللون، ونساعد الناس في الأردن على التواصل مع الطبيعة كل يوم.</p>'},
 'Our Core Values that Drive Everything We Do':{title:'قيمنا في كل ما نفعله'}
 };
 for(const [title,ar]of Object.entries(sectionText)) await db.query("UPDATE page_sections SET translations=$1 WHERE title=$2 AND translations='{}'::jsonb",[{ar},title]);
 const configText={
 'Secure Payment':['دفع آمن','ادفع نقداً عند الاستلام.'], 'Free Shipping':['توصيل مجاني','حسب قيمة الطلب والشروط الموضحة عند الشراء.'], 'Delivered with Care':['توصيل بعناية','نجهز نباتاتك بعناية لتصل إلى بابك.'], 'Excellent Service':['خدمة نهتم بها','نرافقك من اختيار النبات إلى توصيله.'],
 'Passionate About Work':['شغف بالنباتات','نهتم بكل نبات وكل عميل.'],'Creative Team Members':['فريق مبدع','نساعد أفكارك على النمو.'],'Innovation Solutions':['أفكار متجددة','نقرّب الطبيعة إلى مساحتك.'],'Quality Products':['جودة نعتني بها','نباتات مختارة لتمنحك متعة تدوم.'],'Customer Satisfaction':['رضا العملاء','رعاية وخدمة من الطلب إلى التوصيل.'],'Simple Interface':['تجربة سهلة','اختيار نباتك المناسب أصبح أسهل.']};
 for(const row of (await db.query("SELECT id,configuration FROM page_sections WHERE section_type='features'")).rows){let changed=false;for(const item of row.configuration.items||[]){const a=configText[item.title];if(a&&!item.translations){item.translations={ar:{title:a[0],text:a[1]}};changed=true;}if(item.text==='For $50 order'){item.text='On qualifying orders — see checkout';changed=true;}}if(changed)await db.query('UPDATE page_sections SET configuration=$1 WHERE id=$2',[row.configuration,row.id]);}
 for(const [slug,title]of [['home','الرئيسية'],['about','من نحن'],['contact','تواصل معنا']])await db.query("UPDATE pages SET translations=$1 WHERE slug=$2 AND translations='{}'::jsonb",[{ar:{title,seo_title:title+' | غرسة'}},slug]);
 for(const [slug,name]of [['climbing-hanging-plants','النباتات المتسلقة والمعلقة'],['trees','الأشجار']])await db.query("UPDATE categories SET translations=$1 WHERE slug=$2 AND translations='{}'::jsonb",[{ar:{name}},slug]);
 await db.query("INSERT INTO site_settings(key,value) VALUES('v2_details_seeded','true')");
});
await pool.end();console.log('V2 specification cards, general calendar and Arabic CMS content added.');
