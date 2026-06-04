import type {
  OdooClientConfig,
  OdooProduct,
  OdooOrder,
  OdooOrderLine,
  OdooCustomer,
  OdooWarehouse,
  OdooStockQuant,
} from '../types/index.js'

// ─── JSON-RPC helpers ─────────────────────────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: '2.0'
  method: 'call'
  id: number
  params: {
    service: string
    method: string
    args: unknown[]
  }
}

interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0'
  id: number
  result?: T
  error?: {
    code: number
    message: string
    data?: {
      name: string
      message: string
      exception_type: string
      arguments: unknown[]
      debug: string
    }
  }
}

type OdooDomain = Array<string | [string, string, unknown]>

// ─── Circuit breaker states ────────────────────────────────────────────────────

type CircuitState = 'closed' | 'open' | 'half-open'

// ─── OdooClient ───────────────────────────────────────────────────────────────

export class OdooClient {
  private readonly url: string
  private readonly db: string
  private readonly username: string
  private readonly password: string
  private readonly timeout: number
  private readonly maxRetries: number
  private readonly rateLimitPerSec: number

  // Authenticated user id
  private uid: number | null = null

  // Token bucket rate limiting
  private requestCount = 0
  private windowStart = Date.now()

  // Circuit breaker
  private circuitState: CircuitState = 'closed'
  private failureCount = 0
  private lastFailureTime = 0
  private readonly circuitThreshold = 5
  private readonly circuitResetMs = 60_000

  // Auto-incrementing JSON-RPC id
  private rpcId = 1

  constructor(config: OdooClientConfig) {
    this.url = config.url.replace(/\/$/, '')
    this.db = config.db
    this.username = config.username
    this.password = config.password
    this.timeout = config.timeout ?? 30_000
    this.maxRetries = config.maxRetries ?? 3
    this.rateLimitPerSec = config.rateLimit ?? 20
  }

  // ─── Rate limiter ──────────────────────────────────────────────────────────

  private async throttle(): Promise<void> {
    const now = Date.now()
    if (now - this.windowStart >= 1_000) {
      this.requestCount = 0
      this.windowStart = now
    }
    if (this.requestCount >= this.rateLimitPerSec) {
      const waitMs = 1_000 - (now - this.windowStart)
      await new Promise<void>((resolve) => setTimeout(resolve, waitMs))
      this.requestCount = 0
      this.windowStart = Date.now()
    }
    this.requestCount++
  }

  // ─── Circuit breaker ───────────────────────────────────────────────────────

  private checkCircuit(): void {
    if (this.circuitState === 'open') {
      const elapsed = Date.now() - this.lastFailureTime
      if (elapsed >= this.circuitResetMs) {
        this.circuitState = 'half-open'
      } else {
        throw new Error(
          `[OdooClient] Circuit breaker is OPEN. Retry after ${Math.ceil((this.circuitResetMs - elapsed) / 1000)}s.`,
        )
      }
    }
  }

  private recordSuccess(): void {
    this.failureCount = 0
    this.circuitState = 'closed'
  }

  private recordFailure(): void {
    this.failureCount++
    this.lastFailureTime = Date.now()
    if (this.failureCount >= this.circuitThreshold) {
      this.circuitState = 'open'
    }
  }

  // ─── Low-level POST ────────────────────────────────────────────────────────

  private async post<T>(body: JsonRpcRequest): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(`${this.url}/jsonrpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`[OdooClient] HTTP ${response.status}: ${response.statusText}`)
      }

      const json: JsonRpcResponse<T> = await response.json()

      if (json.error) {
        const msg = json.error.data?.message ?? json.error.message
        throw new Error(`[OdooClient] Odoo RPC error: ${msg}`)
      }

      return json.result as T
    } finally {
      clearTimeout(timer)
    }
  }

  // ─── Authenticated model call with retry + circuit breaker ─────────────────

  async rpc<T = unknown>(
    model: string,
    method: string,
    args: unknown[] = [],
    kwargs: Record<string, unknown> = {},
  ): Promise<T> {
    await this.ensureAuth()
    await this.throttle()
    this.checkCircuit()

    const body: JsonRpcRequest = {
      jsonrpc: '2.0',
      method: 'call',
      id: this.rpcId++,
      params: {
        service: 'object',
        method: 'execute_kw',
        args: [this.db, this.uid!, this.password, model, method, args, kwargs],
      },
    }

    let lastError: Error | null = null

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        const delayMs = Math.min(2 ** attempt * 1_000, 16_000)
        await new Promise<void>((resolve) => setTimeout(resolve, delayMs))
      }

      try {
        const result = await this.post<T>(body)
        this.recordSuccess()
        return result
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))

        // Do not retry on Odoo application-level errors (wrong model, access rights, etc.)
        if (lastError.message.includes('Odoo RPC error')) {
          this.recordFailure()
          throw lastError
        }

        this.recordFailure()
        this.checkCircuit() // may throw if circuit opened mid-retry
      }
    }

    throw lastError ?? new Error('[OdooClient] Unknown RPC error after retries')
  }

  // ─── Authentication ────────────────────────────────────────────────────────

  async authenticate(): Promise<void> {
    const body: JsonRpcRequest = {
      jsonrpc: '2.0',
      method: 'call',
      id: this.rpcId++,
      params: {
        service: 'common',
        method: 'authenticate',
        args: [this.db, this.username, this.password, {}],
      },
    }

    const uid = await this.post<number | false>(body)

    if (!uid) {
      throw new Error(
        `[OdooClient] Authentication failed for user "${this.username}" on db "${this.db}"`,
      )
    }

    this.uid = uid
  }

  async ensureAuth(): Promise<void> {
    if (this.uid === null) {
      await this.authenticate()
    }
  }

  // ─── Generic CRUD ──────────────────────────────────────────────────────────

  async search<T = Record<string, unknown>>(
    model: string,
    domain: OdooDomain = [],
    fields: string[] = [],
    limit = 0,
  ): Promise<T[]> {
    const kwargs: Record<string, unknown> = {}
    if (fields.length) kwargs['fields'] = fields
    if (limit > 0) kwargs['limit'] = limit
    return this.rpc<T[]>(model, 'search_read', [domain], kwargs)
  }

  async create(model: string, vals: Record<string, unknown>): Promise<number> {
    return this.rpc<number>(model, 'create', [[vals]])
  }

  async write(
    model: string,
    ids: number[],
    vals: Record<string, unknown>,
  ): Promise<boolean> {
    return this.rpc<boolean>(model, 'write', [ids, vals])
  }

  async unlink(model: string, ids: number[]): Promise<boolean> {
    return this.rpc<boolean>(model, 'unlink', [ids])
  }

  async searchCount(model: string, domain: OdooDomain = []): Promise<number> {
    return this.rpc<number>(model, 'search_count', [domain])
  }

  // ─── Product helpers ───────────────────────────────────────────────────────

  async upsertProduct(
    medusaId: string,
    vals: Record<string, unknown>,
  ): Promise<number> {
    const existing = await this.search<OdooProduct>(
      'product.template',
      [['medusa_product_id', '=', medusaId]],
      ['id'],
      1,
    )

    if (existing.length) {
      const id = existing[0].id
      await this.write('product.template', [id], {
        ...vals,
        medusa_product_id: medusaId,
        medusa_synced: true,
        medusa_sync_date: new Date().toISOString(),
      })
      return id
    }

    return this.create('product.template', {
      ...vals,
      medusa_product_id: medusaId,
      medusa_synced: true,
      medusa_sync_date: new Date().toISOString(),
    })
  }

  async upsertVariant(
    medusaId: string,
    vals: Record<string, unknown>,
  ): Promise<number> {
    const existing = await this.search<OdooProduct>(
      'product.product',
      [['medusa_variant_id', '=', medusaId]],
      ['id'],
      1,
    )

    if (existing.length) {
      const id = existing[0].id
      await this.write('product.product', [id], {
        ...vals,
        medusa_variant_id: medusaId,
        medusa_synced: true,
        medusa_sync_date: new Date().toISOString(),
      })
      return id
    }

    return this.create('product.product', {
      ...vals,
      medusa_variant_id: medusaId,
      medusa_synced: true,
      medusa_sync_date: new Date().toISOString(),
    })
  }

  // ─── Inventory helpers ─────────────────────────────────────────────────────

  /**
   * Update (or create) a stock.quant record for a given product/location,
   * setting the inventory_quantity field (Odoo 16+ inventory adjustment).
   */
  async updateStockQuantity(
    productId: number,
    locationId: number,
    qty: number,
  ): Promise<void> {
    const existing = await this.search<OdooStockQuant>(
      'stock.quant',
      [
        ['product_id', '=', productId],
        ['location_id', '=', locationId],
      ],
      ['id'],
      1,
    )

    if (existing.length) {
      await this.write('stock.quant', [existing[0].id], {
        inventory_quantity: qty,
      })
    } else {
      await this.create('stock.quant', {
        product_id: productId,
        location_id: locationId,
        inventory_quantity: qty,
      })
    }

    // Apply the inventory adjustment
    await this.rpc('stock.quant', 'action_apply_inventory', [[]], {})
  }

  // ─── Order helpers ─────────────────────────────────────────────────────────

  async getOrderByMedusaId(medusaOrderId: string): Promise<OdooOrder | null> {
    const rows = await this.search<OdooOrder>(
      'sale.order',
      [['medusa_order_id', '=', medusaOrderId]],
      ['id', 'name', 'state', 'partner_id', 'amount_total', 'date_order', 'medusa_order_id'],
      1,
    )
    return rows[0] ?? null
  }

  async createSaleOrder(
    vals: Record<string, unknown>,
    lines: Array<Omit<OdooOrderLine, 'product_id'> & { product_id: number }>,
  ): Promise<number> {
    const orderId = await this.create('sale.order', vals)

    if (lines.length) {
      for (const line of lines) {
        await this.create('sale.order.line', {
          order_id: orderId,
          product_id: line.product_id,
          product_uom_qty: line.product_uom_qty,
          price_unit: line.price_unit,
          name: line.name,
        })
      }
    }

    return orderId
  }

  // ─── Customer helpers ──────────────────────────────────────────────────────

  async getCustomerByEmail(email: string): Promise<OdooCustomer | null> {
    const rows = await this.search<OdooCustomer>(
      'res.partner',
      [
        ['email', '=', email],
        ['customer_rank', '>', 0],
      ],
      ['id', 'name', 'email', 'phone', 'street', 'city', 'zip', 'country_id', 'customer_rank'],
      1,
    )
    return rows[0] ?? null
  }

  async upsertCustomer(
    medusaCustomerId: string,
    vals: Record<string, unknown>,
  ): Promise<number> {
    const existing = await this.search<OdooCustomer>(
      'res.partner',
      [['medusa_customer_id', '=', medusaCustomerId]],
      ['id'],
      1,
    )

    if (existing.length) {
      const id = existing[0].id
      await this.write('res.partner', [id], {
        ...vals,
        medusa_customer_id: medusaCustomerId,
      })
      return id
    }

    return this.create('res.partner', {
      ...vals,
      medusa_customer_id: medusaCustomerId,
      customer_rank: 1,
    })
  }

  // ─── Warehouse & stock helpers ─────────────────────────────────────────────

  async getWarehouses(): Promise<OdooWarehouse[]> {
    return this.search<OdooWarehouse>(
      'stock.warehouse',
      [],
      ['id', 'name', 'code', 'lot_stock_id', 'medusa_location_id'],
    )
  }

  async getStockQuants(locationIds: number[]): Promise<OdooStockQuant[]> {
    return this.search<OdooStockQuant>(
      'stock.quant',
      [['location_id', 'in', locationIds]],
      ['id', 'product_id', 'location_id', 'quantity', 'reserved_quantity'],
    )
  }

  // ─── Health check ──────────────────────────────────────────────────────────

  async healthCheck(): Promise<boolean> {
    try {
      await this.rpc('res.users', 'check_access_rights', ['read'], {})
      return true
    } catch {
      return false
    }
  }
}
