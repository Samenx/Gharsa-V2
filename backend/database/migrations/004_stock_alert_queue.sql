-- Durable pending notifications only. No email transport or sender is enabled.
CREATE FUNCTION queue_available_stock() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE product_key INT; variation_key INT; product_name TEXT; n RECORD;
BEGIN
 IF TG_TABLE_NAME='products' THEN
   product_key:=NEW.id; variation_key:=NULL;
   IF NOT NEW.active OR NEW.stock_status<>'in_stock' OR NEW.stock_quantity<=0 OR (OLD.stock_quantity>0 AND OLD.stock_status='in_stock' AND OLD.active) OR EXISTS(SELECT 1 FROM product_variations WHERE product_id=NEW.id AND active) THEN RETURN NEW; END IF;
 ELSE
   product_key:=NEW.product_id; variation_key:=NEW.id;
   IF NOT NEW.active OR NEW.stock_quantity<=0 OR (OLD.stock_quantity>0 AND OLD.active) OR NOT EXISTS(SELECT 1 FROM products WHERE id=NEW.product_id AND active) THEN RETURN NEW; END IF;
 END IF;
 SELECT name INTO product_name FROM products WHERE id=product_key;
 FOR n IN UPDATE stock_notifications SET status='queued' WHERE product_id=product_key AND variation_id IS NOT DISTINCT FROM variation_key AND status='waiting' RETURNING * LOOP
   INSERT INTO email_outbox(recipient,subject,body,event_key) VALUES(n.email,CASE WHEN n.language='ar' THEN 'النبات متوفر مجدداً' ELSE 'Your plant is back in stock' END,CASE WHEN n.language='ar' THEN 'النبات متوفر: ' ELSE 'Available again: ' END || product_name,'stock:'||n.id||':'||extract(epoch from clock_timestamp())) ON CONFLICT DO NOTHING;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER products_stock_alert AFTER UPDATE OF stock_quantity,stock_status,active ON products FOR EACH ROW EXECUTE FUNCTION queue_available_stock();
CREATE TRIGGER variations_stock_alert AFTER UPDATE OF stock_quantity,active ON product_variations FOR EACH ROW EXECUTE FUNCTION queue_available_stock();
