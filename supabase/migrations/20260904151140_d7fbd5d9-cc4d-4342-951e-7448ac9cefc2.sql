CREATE OR REPLACE FUNCTION public.start_production_order(_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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

  SELECT * INTO _order FROM public.production_orders WHERE id = _order_id FOR UPDATE;

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
      -- Cortes agora apenas ficam reservados; a baixa ocorre na conclusão da ordem
      UPDATE public.material_cuts SET status = 'reservado' WHERE id = _item.material_cut_id;
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
$function$;

CREATE OR REPLACE FUNCTION public.complete_production_order(_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  _order public.production_orders%ROWTYPE;
  _product public.products%ROWTYPE;
  _unit_cost numeric;
  _item public.product_materials%ROWTYPE;
  _cut public.material_cuts%ROWTYPE;
  _material public.materials%ROWTYPE;
  _cut_area numeric;
  _piece_area numeric;
  _cut_cost numeric;
  _cuts_cost numeric := 0;
  _cuts_area numeric := 0;
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

  -- Baixa dos cortes: só acontece na conclusão da ordem
  FOR _item IN SELECT * FROM public.product_materials
               WHERE product_id = _order.product_id AND material_cut_id IS NOT NULL ORDER BY id
  LOOP
    SELECT * INTO _cut FROM public.material_cuts WHERE id = _item.material_cut_id FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;
    IF coalesce(_cut.status, 'disponivel') = 'utilizado' THEN CONTINUE; END IF;

    _cut_area := coalesce(_cut.width, 0) * coalesce(_cut.height, 0);
    _cuts_area := _cuts_area + _cut_area;

    SELECT * INTO _material FROM public.materials WHERE id = _cut.material_id FOR UPDATE;
    IF FOUND THEN
      _piece_area := coalesce(_material.width, 0) * coalesce(_material.height, 0);
      IF _piece_area > 0 AND _cut_area > 0 THEN
        _cut_cost := (coalesce(_material.cost_price, 0) / _piece_area) * _cut_area;
        _cuts_cost := _cuts_cost + _cut_cost;
        -- desconta do estoque a fração de peça consumida pela área do corte
        UPDATE public.materials
        SET current_stock = greatest(0, coalesce(current_stock, 0) - (_cut_area / _piece_area)),
            updated_at = now()
        WHERE id = _material.id;
      END IF;
    END IF;

    UPDATE public.material_cuts SET status = 'utilizado' WHERE id = _cut.id;
    UPDATE public.product_materials
    SET unit_cost = coalesce(_cut_cost, unit_cost),
        total_cost = coalesce(_cut_cost, total_cost),
        updated_at = now()
    WHERE id = _item.id;
  END LOOP;

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

  RETURN jsonb_build_object(
    'success', true, 'status', 'completed',
    'cortes_area', _cuts_area, 'cortes_custo', _cuts_cost, 'custo_unitario', _unit_cost
  );
END;
$function$;