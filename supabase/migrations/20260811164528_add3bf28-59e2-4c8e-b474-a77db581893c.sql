CREATE OR REPLACE FUNCTION public.start_production_order(_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _order public.production_orders%ROWTYPE;
  _item public.product_materials%ROWTYPE;
  _needed numeric;
  _stock numeric;
  _cut_status text;
  _bom_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT * INTO _order
  FROM public.production_orders
  WHERE id = _order_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Ordem de produção não encontrada'; END IF;
  IF _order.status <> 'pending' THEN RAISE EXCEPTION 'Apenas ordens pendentes podem ser iniciadas'; END IF;
  IF _order.product_id IS NULL THEN RAISE EXCEPTION 'A ordem não possui produto vinculado'; END IF;
  IF _order.quantity <= 0 THEN RAISE EXCEPTION 'A quantidade da ordem deve ser maior que zero'; END IF;

  SELECT count(*) INTO _bom_count FROM public.product_materials WHERE product_id = _order.product_id;
  IF _bom_count = 0 THEN RAISE EXCEPTION 'O produto não possui composição de materiais cadastrada'; END IF;

  FOR _item IN SELECT * FROM public.product_materials WHERE product_id = _order.product_id ORDER BY id
  LOOP
    _needed := coalesce(_item.quantity, 0) * _order.quantity;
    IF _needed <= 0 THEN RAISE EXCEPTION 'A composição possui material com quantidade inválida'; END IF;

    IF _item.material_cut_id IS NOT NULL THEN
      IF _order.quantity > 1 THEN
        RAISE EXCEPTION 'O corte % é individual e não pode atender % unidades; cadastre um corte para cada unidade', coalesce(_item.material_name, _item.material_cut_id::text), _order.quantity;
      END IF;
      SELECT status INTO _cut_status FROM public.material_cuts WHERE id = _item.material_cut_id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Corte da composição não encontrado'; END IF;
      IF coalesce(_cut_status, 'disponivel') NOT IN ('disponivel', 'reservado') THEN
        RAISE EXCEPTION 'O corte % não está disponível', coalesce(_item.material_name, _item.material_cut_id::text);
      END IF;
    ELSIF _item.material_variation_id IS NOT NULL THEN
      SELECT coalesce(current_stock, 0) INTO _stock FROM public.material_variations WHERE id = _item.material_variation_id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Variação da composição não encontrada'; END IF;
      IF _stock < _needed THEN RAISE EXCEPTION 'Estoque insuficiente da variação %: disponível %, necessário %', coalesce(_item.variation_name, _item.material_variation_id::text), _stock, _needed; END IF;
    ELSIF _item.material_id IS NOT NULL THEN
      SELECT coalesce(current_stock, 0) INTO _stock FROM public.materials WHERE id = _item.material_id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Matéria-prima da composição não encontrada'; END IF;
      IF _stock < _needed THEN RAISE EXCEPTION 'Estoque insuficiente de %: disponível %, necessário %', coalesce(_item.material_name, _item.material_id::text), _stock, _needed; END IF;
    ELSE
      RAISE EXCEPTION 'A composição possui uma linha sem material vinculado';
    END IF;
  END LOOP;

  FOR _item IN SELECT * FROM public.product_materials WHERE product_id = _order.product_id ORDER BY id
  LOOP
    _needed := coalesce(_item.quantity, 0) * _order.quantity;
    IF _item.material_cut_id IS NOT NULL THEN
      UPDATE public.material_cuts SET status = 'utilizado' WHERE id = _item.material_cut_id;
    ELSIF _item.material_variation_id IS NOT NULL THEN
      UPDATE public.material_variations SET current_stock = coalesce(current_stock, 0) - _needed WHERE id = _item.material_variation_id;
    ELSE
      UPDATE public.materials SET current_stock = coalesce(current_stock, 0) - _needed WHERE id = _item.material_id;
    END IF;
  END LOOP;

  UPDATE public.production_orders
  SET status = 'ongoing', started_at = now(), completed_at = NULL, materiais_baixados = true
  WHERE id = _order_id;

  RETURN jsonb_build_object('success', true, 'status', 'ongoing');
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_production_order(_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _order public.production_orders%ROWTYPE;
  _product public.products%ROWTYPE;
  _unit_cost numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;

  SELECT * INTO _order FROM public.production_orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ordem de produção não encontrada'; END IF;
  IF _order.status = 'completed' THEN RAISE EXCEPTION 'Esta ordem já foi concluída'; END IF;
  IF _order.status <> 'ongoing' OR NOT coalesce(_order.materiais_baixados, false) THEN
    RAISE EXCEPTION 'A produção precisa ser iniciada antes da conclusão';
  END IF;
  IF _order.product_id IS NULL THEN RAISE EXCEPTION 'A ordem não possui produto vinculado'; END IF;

  SELECT * INTO _product FROM public.products WHERE id = _order.product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produto da ordem não encontrado'; END IF;

  SELECT coalesce(sum(coalesce(total_cost, coalesce(quantity, 0) * coalesce(unit_cost, 0))), 0)
  INTO _unit_cost FROM public.product_materials WHERE product_id = _order.product_id;

  INSERT INTO public.stock_products (
    produto_id, produto_nome, ordem_producao_id, quantidade_disponivel,
    data_entrada, categoria, preco_custo, preco_venda
  ) VALUES (
    _order.product_id, coalesce(_order.produto_nome, _product.name), _order.id, _order.quantity,
    now(), _product.category, _unit_cost, coalesce(_product.sale_price, 0)
  );

  UPDATE public.products
  SET current_stock = coalesce(current_stock, 0) + _order.quantity, updated_at = now()
  WHERE id = _order.product_id;

  UPDATE public.production_orders
  SET status = 'completed', completed_at = now(), materiais_baixados = true
  WHERE id = _order_id;

  RETURN jsonb_build_object('success', true, 'status', 'completed');
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_production_order(_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _order public.production_orders%ROWTYPE;
  _item public.product_materials%ROWTYPE;
  _needed numeric;
  _product_stock numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;

  SELECT * INTO _order FROM public.production_orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ordem de produção não encontrada ou já excluída'; END IF;

  IF _order.status = 'completed' THEN
    IF _order.product_id IS NULL THEN RAISE EXCEPTION 'A ordem concluída não possui produto vinculado'; END IF;
    SELECT coalesce(current_stock, 0) INTO _product_stock FROM public.products WHERE id = _order.product_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto acabado não encontrado'; END IF;
    IF _product_stock < _order.quantity THEN
      RAISE EXCEPTION 'Não é possível excluir: parte do produto acabado desta ordem já saiu do estoque';
    END IF;

    DELETE FROM public.stock_products WHERE ordem_producao_id = _order.id;
    UPDATE public.products
    SET current_stock = current_stock - _order.quantity, updated_at = now()
    WHERE id = _order.product_id;
  END IF;

  IF coalesce(_order.materiais_baixados, false) AND _order.product_id IS NOT NULL THEN
    FOR _item IN SELECT * FROM public.product_materials WHERE product_id = _order.product_id ORDER BY id
    LOOP
      _needed := coalesce(_item.quantity, 0) * _order.quantity;
      IF _item.material_cut_id IS NOT NULL THEN
        UPDATE public.material_cuts SET status = 'disponivel' WHERE id = _item.material_cut_id;
      ELSIF _item.material_variation_id IS NOT NULL THEN
        UPDATE public.material_variations SET current_stock = coalesce(current_stock, 0) + _needed WHERE id = _item.material_variation_id;
      ELSIF _item.material_id IS NOT NULL THEN
        UPDATE public.materials SET current_stock = coalesce(current_stock, 0) + _needed WHERE id = _item.material_id;
      END IF;
    END LOOP;
  END IF;

  DELETE FROM public.production_orders WHERE id = _order_id;
  RETURN jsonb_build_object('success', true, 'status', 'deleted');
END;
$$;

REVOKE ALL ON FUNCTION public.start_production_order(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_production_order(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_production_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_production_order(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_production_order(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_production_order(uuid) TO authenticated, service_role;