// ─── Entity types tracked across both systems ─────────────────────────────────

export type EntityType =
  | 'product'
  | 'variant'
  | 'order'
  | 'customer'
  | 'inventory'
  | 'invoice'
  | 'warehouse'
  | 'supplier'
  | 'purchase_order'
  | 'fulfillment'
  | 'refund'

export type SyncDirection = 'medusa_to_odoo' | 'odoo_to_medusa' | 'bidirectional'
export type SyncStatus     = 'pending' | 'running' | 'success' | 'failed' | 'partial' | 'skipped'
export type SyncTrigger    = 'event' | 'cron' | 'manual' | 'reconciliation' | 'webhook'
export type MappingStatus  = 'synced' | 'pending' | 'conflict' | 'error'

// ─── BullMQ queue names ───────────────────────────────────────────────────────

export const QUEUE = {
  PRODUCT:       'medusa-odoo-product',
  INVENTORY:     'medusa-odoo-inventory',
  ORDER:         'medusa-odoo-order',
  CUSTOMER:      'medusa-odoo-customer',
  INVOICE:       'medusa-odoo-invoice',
  WAREHOUSE:     'medusa-odoo-warehouse',
  RECONCILE:     'medusa-odoo-reconcile',
  DLQ:           'medusa-odoo-dlq',
} as const

export type QueueName = (typeof QUEUE)[keyof typeof QUEUE]

// ─── Job payloads ─────────────────────────────────────────────────────────────

export interface BaseJobPayload {
  entity_type:     EntityType
  medusa_id:       string
  operation:       'create' | 'update' | 'delete'
  triggered_by:    SyncTrigger
  idempotency_key: string
  attempt?:        number
  data?:           Record<string, unknown>
}

export interface ProductJobPayload extends BaseJobPayload {
  entity_type: 'product'
  variant_ids?: string[]
}

export interface InventoryJobPayload extends BaseJobPayload {
  entity_type: 'inventory'
  variant_id:  string
  location_id?: string
  quantity?:   number
}

export interface OrderJobPayload extends BaseJobPayload {
  entity_type: 'order'
}

export interface CustomerJobPayload extends BaseJobPayload {
  entity_type: 'customer'
}

// ─── Odoo client config ───────────────────────────────────────────────────────

export interface OdooClientConfig {
  url:         string   // https://erp.yourcompany.com
  db:          string   // Odoo database name
  username:    string   // Odoo login / API key owner
  password:    string   // Odoo password OR API key
  timeout?:    number   // ms, default 30_000
  maxRetries?: number   // default 3
  rateLimit?:  number   // req/s, default 20
}

// ─── Odoo domain types ────────────────────────────────────────────────────────

export interface OdooProduct {
  id:              number
  name:            string
  default_code:    string | false
  barcode:         string | false
  list_price:      number
  standard_price:  number
  type:            string
  active:          boolean
  categ_id:        [number, string]
  description_sale: string | false
  medusa_product_id?:  string
  medusa_variant_id?:  string
  medusa_synced?:      boolean
  medusa_sync_date?:   string
}

export interface OdooOrderLine {
  product_id:    [number, string]
  product_uom_qty: number
  price_unit:    number
  name:          string
}

export interface OdooOrder {
  id:            number
  name:          string
  state:         string
  partner_id:    [number, string]
  amount_total:  number
  date_order:    string
  medusa_order_id?: string
}

export interface OdooCustomer {
  id:            number
  name:          string
  email:         string
  phone:         string | false
  street:        string | false
  city:          string | false
  zip:           string | false
  country_id:    [number, string] | false
  customer_rank: number
  medusa_customer_id?: string
}

export interface OdooWarehouse {
  id:                 number
  name:               string
  code:               string
  lot_stock_id:       [number, string]
  medusa_location_id?: string
}

export interface OdooStockQuant {
  id:          number
  product_id:  [number, string]
  location_id: [number, string]
  quantity:    number
  reserved_quantity: number
}

// ─── Plugin options ───────────────────────────────────────────────────────────

export interface OdooPluginOptions {
  odoo_url:          string
  odoo_db:           string
  odoo_username:     string
  odoo_password:     string
  odoo_timeout?:     number
  odoo_rate_limit?:  number
  redis_url?:        string
  webhook_secret?:   string
  sync_products?:    boolean
  sync_inventory?:   boolean
  sync_orders?:      boolean
  sync_customers?:   boolean
  sync_invoices?:    boolean
  batch_size?:       number
}
