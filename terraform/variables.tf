variable "environment" {
  description = "Environment name (development/staging/production)"
  type        = string
  default     = "development"
  
  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be development, staging, or production."
  }
}

variable "domain" {
  description = "Domain name for the application"
  type        = string
  default     = "lux.kushnir.cloud"
}

variable "database_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "lux_prod"
  sensitive   = false
}

variable "database_user" {
  description = "PostgreSQL database user"
  type        = string
  default     = "lux_admin"
  sensitive   = false
}

variable "database_password" {
  description = "PostgreSQL database password"
  type        = string
  sensitive   = true
}

variable "redis_password" {
  description = "Redis password"
  type        = string
  sensitive   = true
  default     = "changeme"
}

variable "oauth_client_id" {
  description = "Google OAuth2 Client ID"
  type        = string
  sensitive   = true
}

variable "oauth_client_secret" {
  description = "Google OAuth2 Client Secret"
  type        = string
  sensitive   = true
}

variable "oauth_cookie_secret" {
  description = "OAuth2 Proxy cookie secret (base64 encoded)"
  type        = string
  sensitive   = true
}

variable "acme_email" {
  description = "Email for Let's Encrypt ACME account"
  type        = string
  default     = "akushnir@bioenergystrategies.com"
}

variable "fastapi_secret_key" {
  description = "FastAPI secret key (base64 encoded)"
  type        = string
  sensitive   = true
}

variable "admin_user_email" {
  description = "Admin user email address for initial setup"
  type        = string
  default     = "akushnir@bioenergystrategies.com"
}

variable "postgres_port" {
  description = "PostgreSQL port"
  type        = number
  default     = 5432
}

variable "redis_port" {
  description = "Redis port"
  type        = number
  default     = 6379
}

variable "fastapi_port" {
  description = "FastAPI port"
  type        = number
  default     = 8000
}

variable "oauth2_proxy_port" {
  description = "OAuth2 Proxy port"
  type        = number
  default     = 4180
}

variable "caddy_http_port" {
  description = "Caddy HTTP port"
  type        = number
  default     = 80
}

variable "caddy_https_port" {
  description = "Caddy HTTPS port"
  type        = number
  default     = 443
}

variable "enable_monitoring" {
  description = "Enable Prometheus monitoring"
  type        = bool
  default     = true
}

variable "log_level" {
  description = "Application log level"
  type        = string
  default     = "INFO"
  
  validation {
    condition     = contains(["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"], var.log_level)
    error_message = "log_level must be DEBUG, INFO, WARNING, ERROR, or CRITICAL."
  }
}

variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default = {
    Project     = "Lux-Auto"
    ManagedBy   = "Terraform"
    CreatedDate = "2026-04-12"
  }
}
