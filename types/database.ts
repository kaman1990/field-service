export interface Asset {
  id: string;
  name: string;
  internal_id: string;
  description?: string;
  type?: string;
  manufacturer?: string;
  model?: string;
  serial_no?: string;
  notes?: string;
  install_notes?: string;
  action_notes?: string;
  image_url?: string;
  ei_machine_id?: number;
  area_id?: string;
  iot_status_id?: string;
  site_id?: string;
  health_status_id?: string;
  gateway_id?: string;
  survey_gateway_id?: string;
  orientation?: string;
  motor_type?: string;
  duty_cycle?: string;
  criticality?: string;
  expected_gateway?: string;
  vfd?: boolean;
  gearbox?: boolean;
  atex_area?: boolean;
  ambient_temp?: boolean;
  wash_down?: boolean;
  loto?: boolean;
  guard_removal?: boolean;
  guard_mod?: boolean;
  height_work?: boolean;
  confined_space?: boolean;
  restricted_access?: boolean;
  nameplate_missing?: boolean;
  install_approved?: boolean;
  fins?: number;
  sensors_m?: number;
  sensors_gb?: number;
  sensors_e?: number;
  image_count?: number;
  enabled?: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
  deleted_at?: string;
  deleted_by?: string;
}

export interface Point {
  id: string;
  name: string;
  description?: string;
  serial_no?: number;
  full_serial_no?: string;
  notes?: string;
  bearing?: string;
  sensor_orientation?: string;
  asset_part?: string;
  position?: string;
  asset_id?: string;
  gateway_id?: string;
  pref_gateway_id?: string;
  site_id?: string;
  iot_status_id?: string;
  mean_x?: number;
  mean_y?: number;
  mean_z?: number;
  sd_x?: number;
  sd_y?: number;
  sd_z?: number;
  calc_satisfactory?: number;
  calc_warning?: number;
  calc_alarm?: number;
  temp_satisfactory?: number;
  temp_warning?: number;
  temp_alarm?: number;
  iso_warning?: number;
  iso_alarm?: number;
  satisfactory?: number;
  warning?: number;
  alarm?: number;
  iso_satisfactory?: number;
  speed?: number;
  readings_last_day?: number;
  waveform_last_day?: number;
  last_reading?: string;
  internal_id?: string;
  image_count?: number;
  enabled?: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
  deleted_at?: string;
  deleted_by?: string;
}

export interface Gateway {
  id: string;
  code?: string;
  description?: string;
  serial_no?: number;
  mac_address?: string;
  ip_address?: string;
  location?: string;
  router?: string;
  version?: string;
  notes?: string;
  action_notes?: string;
  connection_type?: string;
  mount_type?: string;
  power_type?: string;
  site_id?: string;
  area_id?: string;
  status_id?: string;
  online?: boolean;
  power_required?: boolean;
  poe_required?: boolean;
  router_required?: boolean;
  flex_required?: boolean;
  atex_area?: boolean;
  install_approved: boolean;
  iot_status_id?: string;
  internal_id?: string;
  image_count?: number;
  enabled?: boolean;
  created_at: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
  deleted_at?: string;
  deleted_by?: string;
}

export interface Site {
  id: string;
  name?: string;
  description?: string;
  location?: string;
  company_id?: string;
  survey_engineers?: string;
  survey_date?: string;
  install_engineers?: string;
  install_date?: string;
  enabled: boolean;
  created_at: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
  deleted_at?: string;
  deleted_by?: string;
}

export interface Area {
  id: string;
  name: string;
  description?: string;
  location?: string;
  site_id?: string;
  ei_area_id?: number;
  atex_area?: boolean;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
  deleted_at?: string;
  deleted_by?: string;
}

export interface AssetHealthStatus {
  id: string;
  status?: string;
  sort?: number;
  enabled?: boolean;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
  deleted_at?: string;
  deleted_by?: string;
}

export interface AssetIotStatus {
  id: string;
  status?: string;
  code?: string;
  sort_order?: number;
  enabled?: boolean;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
  deleted_at?: string;
  deleted_by?: string;
}

export interface PointIotStatus {
  id: string;
  status?: string;
  code?: string;
  sort?: number;
  enabled?: boolean;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
  deleted_at?: string;
  deleted_by?: string;
}

export interface AssetType {
  id: number;
  type?: string;
  enabled?: boolean;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
  deleted_at?: string;
  deleted_by?: string;
}

export interface GatewayStatus {
  id: string;
  status?: string;
  enabled?: boolean;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
  deleted_at?: string;
  deleted_by?: string;
}

export interface GatewayIotStatus {
  id: string;
  status?: string;
  code?: string;
  sort_order?: number;
  enabled?: boolean;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
  deleted_at?: string;
  deleted_by?: string;
}

export interface Image {
  id: string;
  image_url?: string;
  image_id?: string; // Storage bucket filename
  asset_id?: string;
  point_id?: string;
  gateway_id?: string;
  site_id?: string;
  default?: boolean;
  valid?: boolean;
  enabled: boolean;
  created_at: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
  deleted_at?: string;
  deleted_by?: string;
}

export interface AssetAdditionalDetail {
  id: number;
  asset_id: string;
  field: string;
  value: string;
  enabled?: boolean;
  created_at: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
  deleted_at?: string;
  deleted_by?: string;
}

export interface AssetHistory {
  id: string;
  asset_id?: string;
  description?: string;
  details?: string;
  enabled?: boolean;
  created_at: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
  deleted_at?: string;
  deleted_by?: string;
}

export interface RetoolUser {
  id: string;
  created_at?: string;
  email?: string;
  default_site_id?: string;
  name?: string;
  is_admin?: boolean;
  image_url?: string;
  default_company_id?: string;
  show_search?: boolean;
  app_mode?: string;
  updated_at?: string;
  enabled?: boolean;
  created_by?: string;
  updated_by?: string;
  auth_id?: string;
  deleted_at?: string;
  deleted_by?: string;
}

export interface UserSite {
  id: string;
  user_id: string;
  site_id: string;
  enabled?: boolean;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
  deleted_at?: string;
  deleted_by?: string;
}

export interface Company {
  id: string;
  name?: string;
  enabled?: boolean;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
  deleted_at?: string;
  deleted_by?: string;
}

