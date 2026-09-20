ALTER TABLE order_items ADD COLUMN return_snapshot JSONB;
CREATE TABLE product_categories(product_id INT REFERENCES products ON DELETE CASCADE,category_id INT REFERENCES categories ON DELETE CASCADE,PRIMARY KEY(product_id,category_id));
CREATE INDEX product_categories_category_idx ON product_categories(category_id,product_id);
CREATE INDEX orders_status_created_idx ON orders(status,created_at);
CREATE INDEX order_items_product_idx ON order_items(product_id);
CREATE INDEX products_price_idx ON products(regular_price) WHERE active;
ALTER TABLE product_variations ALTER COLUMN active SET NOT NULL;
ALTER TABLE delivery_rules ADD CONSTRAINT delivery_workdays CHECK (weekend_days <@ ARRAY[0,1,2,3,4,5,6] AND NOT weekend_days @> ARRAY[0,1,2,3,4,5,6]);
INSERT INTO product_categories SELECT p.id,c.id FROM products p CROSS JOIN categories c WHERE (c.slug='office-plants' AND p.slug IN ('snake-plant','golden-pothos','hanging-pothos','heartleaf-philodendron','phalaenopsis-orchid')) OR (c.slug IN ('office-low-light','office-low-maintenance') AND p.slug IN ('snake-plant','golden-pothos','heartleaf-philodendron')) OR (c.slug='reception-plants' AND p.slug IN ('phalaenopsis-orchid','snake-plant')) ON CONFLICT DO NOTHING;
