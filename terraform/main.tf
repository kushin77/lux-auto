terraform {
  required_version = ">= 1.0"
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.0"
    }
  }

  # Uncomment for production remote state
  # backend "gcs" {
  #   bucket = "lux-auto-terraform"
  #   prefix = "production"
  # }
}

provider "docker" {
  host = "unix:///var/run/docker.sock"
}

provider "null" {}

# Local variables
locals {
  app_name = "lux-auto"
  environment = var.environment
  domain = var.domain
  
  # Docker image tags
  postgres_image = "postgres:16-alpine"
  redis_image    = "redis:7-alpine"
  oauth_image    = "quay.io/oauth2-proxy/oauth2-proxy:v7.6.0"
  caddy_image    = "caddy:2.7-alpine"
  
  # Network configuration
  network_name = "${local.app_name}-network"
  
  # Service names
  services = {
    postgres = "${local.app_name}-postgres"
    cache    = "${local.app_name}-cache"
    oauth    = "${local.app_name}-oauth2-proxy"
    caddy    = "${local.app_name}-caddy"
    fastapi  = "${local.app_name}-fastapi"
  }
  
  # Port mappings
  ports = {
    postgres = 5432
    redis    = 6379
    oauth    = 4180
    caddy_http  = 80
    caddy_https = 443
    fastapi  = 8000
    caddy_admin = 2019
  }
  
  # Volume names
  volumes = {
    postgres_data  = "${local.app_name}-postgres-data"
    redis_data     = "${local.app_name}-redis-data"
    caddy_data     = "${local.app_name}-caddy-data"
    caddy_config   = "${local.app_name}-caddy-config"
  }
  
  labels = {
    app         = local.app_name
    environment = local.environment
    managed_by  = "terraform"
  }
}

# Create Docker network
resource "docker_network" "main" {
  name   = local.network_name
  driver = "bridge"

  labels {
    label = "app"
    value = local.app_name
  }

  labels {
    label = "environment"
    value = local.environment
  }
}

# Create volumes
resource "docker_volume" "postgres_data" {
  name = local.volumes.postgres_data

  labels {
    label = "app"
    value = local.app_name
  }
}

resource "docker_volume" "redis_data" {
  name = local.volumes.redis_data

  labels {
    label = "app"
    value = local.app_name
  }
}

resource "docker_volume" "caddy_data" {
  name = local.volumes.caddy_data

  labels {
    label = "app"
    value = local.app_name
  }
}

resource "docker_volume" "caddy_config" {
  name = local.volumes.caddy_config

  labels {
    label = "app"
    value = local.app_name
  }
}

# PostgreSQL Container
resource "docker_container" "postgres" {
  name  = local.services.postgres
  image = data.docker_image.postgres.image_id
  restart_policy = "unless-stopped"

  network_mode = docker_network.main.name

  env = [
    "POSTGRES_DB=${var.database_name}",
    "POSTGRES_USER=${var.database_user}",
    "POSTGRES_PASSWORD=${var.database_password}",
    "POSTGRES_INITDB_ARGS=--encoding=UTF8 --locale=en_US.UTF-8",
  ]

  volumes {
    volume_name = docker_volume.postgres_data.name
    container_path = "/var/lib/postgresql/data"
  }

  ports {
    internal = local.ports.postgres
    external = local.ports.postgres
  }

  healthcheck {
    test     = ["CMD-SHELL", "pg_isready -U ${var.database_user}"]
    interval = "10s"
    timeout  = "5s"
    retries  = 5
    start_period = "30s"
  }

  labels {
    label = "service"
    value = "postgres"
  }
}

# Redis Container
resource "docker_container" "redis" {
  name  = local.services.cache
  image = data.docker_image.redis.image_id
  restart_policy = "unless-stopped"

  network_mode = docker_network.main.name

  command = [
    "redis-server",
    "--appendonly", "yes",
    "--requirepass", var.redis_password
  ]

  volumes {
    volume_name = docker_volume.redis_data.name
    container_path = "/data"
  }

  ports {
    internal = local.ports.redis
    external = local.ports.redis
  }

  healthcheck {
    test     = ["CMD", "redis-cli", "ping"]
    interval = "10s"
    timeout  = "5s"
    retries  = 5
    start_period = "30s"
  }

  labels {
    label = "service"
    value = "redis"
  }

  depends_on = [docker_network.main]
}

# OAuth2 Proxy Container
resource "docker_container" "oauth2_proxy" {
  name  = local.services.oauth
  image = data.docker_image.oauth2_proxy.image_id
  restart_policy = "unless-stopped"

  network_mode = docker_network.main.name

  env = [
    "OAUTH2_PROXY_PROVIDER=google",
    "OAUTH2_PROXY_CLIENT_ID=${var.oauth_client_id}",
    "OAUTH2_PROXY_CLIENT_SECRET=${var.oauth_client_secret}",
    "OAUTH2_PROXY_COOKIE_SECRET=${var.oauth_cookie_secret}",
    "OAUTH2_PROXY_COOKIE_SECURE=true",
    "OAUTH2_PROXY_COOKIE_HTTPONLY=true",
    "OAUTH2_PROXY_COOKIE_SAMESITE=Strict",
    "OAUTH2_PROXY_EMAIL_DOMAINS=*",
    "OAUTH2_PROXY_UPSTREAMS=http://${local.services.fastapi}:${local.ports.fastapi}",
    "OAUTH2_PROXY_HTTP_ADDRESS=0.0.0.0:${local.ports.oauth}",
    "OAUTH2_PROXY_REDIRECT_URL=https://${local.domain}/oauth2/callback",
    "OAUTH2_PROXY_PASS_USER_HEADERS=true",
    "OAUTH2_PROXY_PASS_AUTHORIZATION_HEADER=true",
    "OAUTH2_PROXY_SET_AUTHORIZATION_HEADER=true",
  ]

  ports {
    internal = local.ports.oauth
    external = local.ports.oauth
  }

  labels {
    label = "service"
    value = "oauth2-proxy"
  }

  depends_on = [docker_container.postgres]
}

# Caddy Reverse Proxy Container
resource "docker_container" "caddy" {
  name  = local.services.caddy
  image = data.docker_image.caddy.image_id
  restart_policy = "unless-stopped"

  network_mode = docker_network.main.name

  env = [
    "DOMAIN=${local.domain}",
    "ACME_EMAIL=${var.acme_email}",
    "CADDY_ADMIN=0.0.0.0:${local.ports.caddy_admin}",
  ]

  volumes {
    source      = abspath("${path.root}/../Caddyfile.tpl")
    container_path = "/etc/caddy/Caddyfile"
    read_only   = true
  }

  volumes {
    volume_name = docker_volume.caddy_data.name
    container_path = "/data"
  }

  volumes {
    volume_name = docker_volume.caddy_config.name
    container_path = "/config"
  }

  ports {
    internal = 80
    external = local.ports.caddy_http
  }

  ports {
    internal = 443
    external = local.ports.caddy_https
  }

  ports {
    internal = local.ports.caddy_admin
    external = local.ports.caddy_admin
  }

  labels {
    label = "service"
    value = "caddy"
  }

  depends_on = [docker_container.oauth2_proxy]
}

# Data sources for images
data "docker_image" "postgres" {
  name = local.postgres_image
}

data "docker_image" "redis" {
  name = local.redis_image
}

data "docker_image" "oauth2_proxy" {
  name = local.oauth_image
}

data "docker_image" "caddy" {
  name = local.caddy_image
}

# Output the network ID and service ports for reference
output "docker_network_id" {
  value       = docker_network.main.id
  description = "Docker network ID"
}

output "services" {
  value = {
    postgres = local.services.postgres
    redis    = local.services.cache
    oauth    = local.services.oauth
    caddy    = local.services.caddy
  }
  description = "Service container names"
}

output "access_points" {
  value = {
    http_port   = local.ports.caddy_http
    https_port  = local.ports.caddy_https
    fastapi_port = local.ports.fastapi
    caddy_admin = local.ports.caddy_admin
  }
  description = "Service access points and ports"
}
