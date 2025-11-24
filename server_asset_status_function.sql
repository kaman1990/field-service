DECLARE
  -- asset status ids
  v_a_not_required        uuid := (select id from public.asset_iot_status where code = 'NOT_REQUIRED');
  v_a_not_installed       uuid := (select id from public.asset_iot_status where code = 'NOT_INSTALLED');
  v_a_not_mapped          uuid := (select id from public.asset_iot_status where code = 'NOT_MAPPED');
  v_a_missing_image       uuid := (select id from public.asset_iot_status where code = 'MISSING_IMAGE');
  v_a_partially_installed uuid := (select id from public.asset_iot_status where code = 'PARTIALLY_INSTALLED');
  v_a_installed           uuid := (select id from public.asset_iot_status where code = 'INSTALLED');
  v_a_communicating       uuid := (select id from public.asset_iot_status where code = 'COMMUNICATING');

  -- point status ids
  v_p_not_required  uuid := (select id from public.point_iot_status where code = 'NOT_REQUIRED');
  v_p_not_installed uuid := (select id from public.point_iot_status where code = 'NOT_INSTALLED');
  v_p_not_mapped    uuid := (select id from public.point_iot_status where code = 'NOT_MAPPED');
  v_p_installed     uuid := (select id from public.point_iot_status where code = 'INSTALLED');
  v_p_communicating uuid := (select id from public.point_iot_status where code = 'COMMUNICATING');

  -- accept id from assets first, then asset_id from points/images
  v_asset_id uuid := coalesce(NEW.id, OLD.id, NEW.asset_id, OLD.asset_id);
  v_curr     uuid;
  v_new      uuid;

  v_nm_cnt int := 0;
  v_i_cnt  int := 0;
  v_c_cnt  int := 0;
  v_img_cnt int := 0;
  v_eligible_count int := 0;
BEGIN
  IF v_asset_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- respect manual asset statuses
  SELECT a.iot_status_id INTO v_curr
  FROM public.assets a
  WHERE a.id = v_asset_id;

  IF v_curr IN (v_a_not_required, v_a_not_installed) THEN
    RETURN NULL;
  END IF;

  -- eligible points only: enabled and not NR/NI
  -- Count total eligible points and status-specific counts
  SELECT
    count(*) FILTER (WHERE p.iot_status_id = v_p_not_mapped),
    count(*) FILTER (WHERE p.iot_status_id = v_p_installed),
    count(*) FILTER (WHERE p.iot_status_id = v_p_communicating),
    count(*) -- total eligible points
  INTO v_nm_cnt, v_i_cnt, v_c_cnt, v_eligible_count
  FROM public.points p
  WHERE p.asset_id = v_asset_id
    AND p.enabled = true
    AND p.iot_status_id NOT IN (v_p_not_required, v_p_not_installed);

  -- asset image count
  SELECT count(*)::int INTO v_img_cnt
  FROM public.images i
  WHERE i.asset_id = v_asset_id
    AND i.enabled = true;

  -- precedence with check for ALL points matching status
  v_new :=
    CASE
      -- All eligible points are COMMUNICATING
      WHEN v_nm_cnt = 0 AND v_i_cnt = 0 AND v_c_cnt > 0 AND v_c_cnt = v_eligible_count
        THEN v_a_communicating
      
      -- All eligible points are INSTALLED (check images for MISSING_IMAGE vs INSTALLED)
      WHEN v_nm_cnt = 0 AND v_i_cnt > 0 AND v_c_cnt = 0 AND v_i_cnt = v_eligible_count
        THEN CASE WHEN v_img_cnt = 0 THEN v_a_missing_image ELSE v_a_installed END
      
      -- Some points are INSTALLED but not all (or mixed with NOT_MAPPED)
      WHEN v_i_cnt > 0 AND v_nm_cnt > 0
        THEN v_a_partially_installed
      
      -- Some points are INSTALLED but not all (and no NOT_MAPPED)
      WHEN v_nm_cnt = 0 AND v_i_cnt > 0 AND v_i_cnt < v_eligible_count
        THEN v_a_partially_installed
      
      -- Some points are COMMUNICATING but not all
      WHEN v_c_cnt > 0 AND v_c_cnt < v_eligible_count
        THEN v_a_partially_installed
      
      -- Default to NOT_MAPPED
      ELSE v_a_not_mapped
    END;

  UPDATE public.assets a
  SET iot_status_id = v_new
  WHERE a.id = v_asset_id
    AND a.iot_status_id IS DISTINCT FROM v_new;

  RETURN NULL;
END;

