import {transaction,pool} from '../../src/config/db.js';
await transaction(async db=>{
 if((await db.query("SELECT 1 FROM site_settings WHERE key='v2_content_seeded'")).rowCount)return;
 const arabic={
 'bougainvillea':['الجهنمية','نبات خارجي يزدهر في الأماكن المشمسة. يناسب الحدائق والشرفات والجدران والأسوار. اترك التربة تجف جزئياً بين مرات الري ووفر دعامة أثناء النمو.'],
 'bougainvillea-flowering-plant':['الجهنمية المزهرة','تمنح الجهنمية ألواناً زاهية في الأجواء الدافئة المشمسة. تناسب الأحواض الخارجية والشرفات والأسوار. تجنب الإفراط في الري.'],
 'geranium':['الجيرانيوم','نبات مزهر بألوان جميلة وأوراق جذابة، يناسب الأماكن المشمسة وأحواض الشرفات. اسقه عندما تبدأ التربة بالجفاف وأزل الأزهار الذابلة.'],
 'orange-tree':['شجرة البرتقال','شجرة فاكهة دائمة الخضرة تناسب الحدائق الخارجية الواسعة. تحتاج إلى ضوء شمس وفير وتصريف جيد وري منتظم خلال النمو.'],
 'lavender':['اللافندر','نبات خارجي عطري بأزهار بنفسجية. يفضل الشمس والتربة جيدة التصريف. تجنب الإفراط في الري ووفر تهوية جيدة.'],
 'snake-plant':['جلد النمر','نبات داخلي قوي بأوراق قائمة وشكل عصري. يحتاج إلى عناية قليلة ويتحمل ظروف إضاءة داخلية متنوعة. اسقه بعد جفاف التربة.'],
 'marigold':['القطيفة','نبات موسمي بأزهار برتقالية وحمراء وأوراق خضراء كثيفة. يناسب الأحواض والحدائق المشمسة. أزل الأزهار القديمة للحفاظ على مظهره.'],
 'phalaenopsis-orchid':['أوركيد الفالينوبسيس','أوركيد داخلي بأزهار أنيقة تدوم لأسابيع مع العناية المناسبة. ضعه في ضوء ساطع غير مباشر ووسط زراعة خاص جيد التصريف. لا تترك الجذور في الماء.'],
 'jasmine':['الياسمين','نبات بأزهار بيضاء عطرة يناسب الحدائق والشرفات والأحواض. وفر ضوءاً جيداً ودعامة للأصناف المتسلقة ورياً منتظماً خلال النمو.'],
 'red-rose-plant':['الورد الأحمر','نبات بأزهار حمراء جميلة للحديقة. ضعه في مكان مشمس جيد التهوية وتربة جيدة التصريف. اسقه بانتظام في الحر وأزل الأزهار الذابلة.'],
 'star-jasmine':['الياسمين النجمي','نبات متسلق بأوراق خضراء لامعة وأزهار بيضاء عطرة. يناسب الأسوار والجدران مع دعامة للتسلق وضوء جيد وري منتظم في الحر.'],
 'hanging-pothos':['البوتس المتدلي','نبات سهل العناية بسيقان متدلية يناسب السلال المعلقة والرفوف. يفضل الضوء الساطع غير المباشر. اسقه عندما تجف الطبقة العليا من التربة.'],
 'string-of-hearts':['سلسلة القلوب','نبات متدلٍ بأوراق صغيرة على شكل قلوب. يفضل الضوء الساطع غير المباشر والتربة جيدة التصريف. اترك التربة تجف بين مرات الري.'],
 'heartleaf-philodendron':['فيلوديندرون قلبي الأوراق','نبات داخلي متسلق ومتدلٍ بأوراق قلبية. يفضل الضوء الساطع غير المباشر ويتحمل الإضاءة المتوسطة. اترك التربة تجف قليلاً بين مرات الري.'],
 'golden-pothos':['البوتس الذهبي','نبات داخلي سهل العناية للمبتدئين. يناسب الرفوف والسلال المعلقة. يفضل الضوء الساطع غير المباشر ويتحمل الإضاءة المنخفضة. اسقه عندما يجف سطح التربة وتجنب الإفراط في الري.']};
 for(const p of (await db.query('SELECT * FROM products ORDER BY id')).rows){
 const info=arabic[p.slug];if(!info)continue;
 const sentences=p.description.replace('Product description:\n','').split(/(?<=\.)\s+/);
 const story={introduction:sentences[0]||p.short_description,why_love:sentences[1]||'',care:sentences.slice(2).join(' ')};
 await db.query("UPDATE products SET translations=CASE WHEN translations='{}'::jsonb THEN $1 ELSE translations END,story=CASE WHEN story='{}'::jsonb THEN $2 ELSE story END WHERE id=$3",[{ar:{name:info[0],description:info[1],short_description:info[1],seo_title:info[0]+' | غرسة',meta_description:info[1]}},story,p.id]);
 const indoor=/pothos|snake|orchid|hearts|philodendron/.test(p.slug);
 const locations=indoor?['living-room','reception',...(/pothos|snake|philodendron/.test(p.slug)?['office-desk']:[])]:['garden','sunny-area',...(p.slug!=='orange-tree'?['balcony','containers']:[])];
 await db.query('INSERT INTO product_locations SELECT $1,id FROM suitable_locations WHERE slug=ANY($2::text[]) ON CONFLICT DO NOTHING',[p.id,locations]);
 await db.query('INSERT INTO faqs(product_id,question,answer,group_name,translations) VALUES($1,$2,$3,$4,$5)',[p.id,`How should I care for my ${p.name}?`,p.description,'Plant care',{ar:{question:`كيف أعتني بنبات ${info[0]}؟`,answer:info[1]}}]);
 }
 const translations={'indoor-plants':'النباتات الداخلية','outdoor-plants':'النباتات الخارجية','hanging-plants':'النباتات المعلقة','flowering-plants':'النباتات المزهرة','sales':'التخفيضات','fruit-trees':'أشجار الفاكهة','climbing-plants':'النباتات المتسلقة'};
 for(const [slug,name] of Object.entries(translations))await db.query("UPDATE categories SET translations=$1 WHERE slug=$2 AND translations='{}'::jsonb",[{ar:{name}},slug]);
 const labels={Home:'الرئيسية',Shop:'المتجر',About:'من نحن','About Us':'من نحن',Contact:'تواصل معنا','Contact Us':'تواصل معنا',Sales:'التخفيضات'};
 for(const [label,ar]of Object.entries(labels))await db.query("UPDATE menu_items SET translations=$1 WHERE label=$2 AND translations='{}'::jsonb",[{ar:{label:ar}},label]);
 const slides=[{image:'/images/product-golden-pothos-1.webp',mobile_image:'/images/product-golden-pothos-1.webp',alt:'Golden pothos in a terracotta pot by a bright window',title:'A little green. A lot of life.',text:'Find the plant that feels at home in your space. Thoughtfully chosen, carefully packed, ready to grow with you.',button:'Explore plants',url:'/shop',secondary_button:'Find your perfect plant',secondary_url:'/faq',translations:{ar:{title:'لمسة خضراء. حياة أجمل.',text:'اختر نباتاً يناسب مساحتك. نختاره بعناية ونجهزه لينمو معك.',button:'اكتشف النباتات',secondary_button:'اختر نباتك المثالي',eyebrow:'غرسة · حياة في كل زاوية'}}},{image:'/images/product-bougainvillea-0.webp',alt:'Colourful bougainvillea',title:'Make room for colour.',text:'Turn a sunny corner into your favourite place to be. Explore plants for gardens, balconies and everyday moments outdoors.',button:'Discover outdoor plants',url:'/shop?category=outdoor-plants',translations:{ar:{title:'مساحة للألوان.',text:'اجعل زاويتك المشمسة مكانك المفضل. اكتشف نباتات الحدائق والشرفات.',button:'اكتشف النباتات الخارجية',eyebrow:'غرسة · ألوان من الطبيعة'}}}];
 // Only replace the original seed slider, never a merchant-created slider.
 await db.query("UPDATE page_sections SET configuration=$1 WHERE page_id=(SELECT id FROM pages WHERE slug='home') AND section_type IN ('hero','image_slider') AND configuration->'slides'->0->>'image'='/images/reference-2.webp'",[{slides}]);
 await db.query("INSERT INTO product_categories SELECT p.id,c.id FROM products p CROSS JOIN categories c WHERE (c.slug='office-plants' AND p.slug IN ('snake-plant','golden-pothos','hanging-pothos','heartleaf-philodendron','phalaenopsis-orchid')) OR (c.slug IN ('office-low-light','office-low-maintenance') AND p.slug IN ('snake-plant','golden-pothos','heartleaf-philodendron')) OR (c.slug='reception-plants' AND p.slug IN ('phalaenopsis-orchid','snake-plant')) ON CONFLICT DO NOTHING");
 await db.query("INSERT INTO site_settings(key,value) VALUES('v2_content_seeded','true')");
});
await pool.end();console.log('V2 original-photo hero, catalogue translations and product care content ready.');
