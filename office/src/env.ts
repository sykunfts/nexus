/* Bindings, vars and secrets the Worker is deployed with (wrangler.toml + GitHub secrets). */
export interface Env {
  ORDERS: KVNamespace
  SITE_URL: string
  FROM_EMAIL: string
  EMAIL_ENABLED: string
  ADMIN_EMAIL: string
  CJ_DRY_RUN: string
  DEV?: string
  STRIPE_SECRET_KEY: string
  STRIPE_WEBHOOK_SECRET: string
  CJ_API_KEY: string
  RESEND_API_KEY: string
  ADMIN_TOKEN: string
}
