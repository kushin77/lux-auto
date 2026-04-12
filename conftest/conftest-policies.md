# Conftest Configuration
# OPA/Rego policies for IaC security enforcement
# Document: describes policies enforced on Terraform, Kubernetes, Docker

features:
  # Generic rules (applied to any YAML)
  general:
    # No public S3 buckets
    - rule: no_public_s3_buckets
      description: "S3 buckets must have block_public_access = true"
      severity: HIGH

    # No overly permissive security groups
    - rule: no_open_ports
      description: "Security groups must not allow 0.0.0.0/0 on critical ports (22, 3306, 5432)"
      severity: HIGH

    # All resources require tags
    - rule: require_resource_tags
      description: "All resources must have environment, team, cost-center tags"
      severity: MEDIUM

    # No unencrypted storage
    - rule: require_encryption_at_rest
      description: "Databases, S3, volumes must have encryption enabled"
      severity: HIGH

  # Terraform-specific
  terraform:
    # All infrastructure changes require ADR
    - rule: terraform_changes_require_adr
      description: "Major schema changes must be documented in docs/adr/"
      severity: MEDIUM

    # No hardcoded credentials in TF files
    - rule: no_hardcoded_secrets
      description: "Use variable_sensitive=true for passwords, keys, tokens"
      severity: CRITICAL

    # Connection limits defined
    - rule: db_connection_limits
      description: "RDS/PostgreSQL must have max_allocated_storage, backup_retention_days set"
      severity: MEDIUM

    # Monitoring required
    - rule: monitoring_enabled
      description: "Resources must have CloudWatch monitoring (or equivalent)"
      severity: MEDIUM

  # Kubernetes-specific
  kubernetes:
    # Resource limits required
    - rule: require_resource_limits
      description: "Pods must define resource requests and limits (CPU, memory)"
      severity: MEDIUM

    # No privileged containers
    - rule: no_privileged_containers
      description: "Container security context: privileged=false"
      severity: HIGH

    # Health checks required
    - rule: require_health_checks
      description: "Deployments must define liveness and readiness probes"
      severity: MEDIUM

    # Network policies
    - rule: require_network_policies
      description: "Namespaces with multiple pods must have NetworkPolicy"
      severity: MEDIUM

  # Docker-specific
  docker:
    # No root user
    - rule: no_root_user
      description: "Dockerfile must specify USER (not root)"
      severity: HIGH

    # Pin image versions
    - rule: pin_image_versions
      description: "FROM directives must use specific version tags, not 'latest'"
      severity: MEDIUM

    # Scan image for vulnerabilities
    - rule: scan_image_vulnerabilities
      description: "Container images must pass Trivy scan (no HIGH/CRITICAL)"
      severity: HIGH

---

# Example Rego Policies (place in conftest/ directory)
# File: conftest/deny.rego

package main

# ===== General Rules =====

# Deny public S3 buckets
deny[msg] {
    resource := input.resource[_]
    resource.type == "aws_s3_bucket"
    not resource.properties.acl == "private"
    msg := sprintf("S3 bucket must have acl=private, got %v", [resource.properties.acl])
}

# Deny security groups with 0.0.0.0/0
deny[msg] {
    rule := input.ingress_rule[_]
    rule.cidr_blocks[_] == "0.0.0.0/0"
    rule.from_port < 1024  # Critical port
    msg := sprintf("Security group allows 0.0.0.0/0 on port %d (critical)", [rule.from_port])
}

# Require resource tags
deny[msg] {
    resource := input.resource[_]
    resource.type == "aws_instance"
    not resource.tags.environment
    msg := sprintf("Resource %s missing 'environment' tag", [resource.name])
}

# ===== Database Rules =====

# Require encryption at rest
deny[msg] {
    resource := input.resource[_]
    resource.type == "aws_db_instance"
    not resource.storage_encrypted
    msg := sprintf("RDS instance must have storage_encrypted=true")
}

# Require backup retention
deny[msg] {
    resource := input.resource[_]
    resource.type == "aws_db_instance"
    not resource.backup_retention_period
    msg := sprintf("RDS instance must have backup_retention_period (>=7 days)")
}

# ===== Kubernetes Rules =====

# Require resource limits
deny[msg] {
    pod := input.spec.containers[_]
    not pod.resources.limits
    msg := sprintf("Container must define resource limits (CPU, memory)")
}

# No privileged containers
deny[msg] {
    pod := input.spec.containers[_]
    pod.securityContext.privileged == true
    msg := sprintf("Container must not run privileged")
}

# Require liveness probe
deny[msg] {
    pod := input.spec.containers[_]
    pod.name == "backend"
    not pod.livenessProbe
    msg := sprintf("Backend container must define livenessProbe")
}

# ===== Docker Rules =====

# Require specific image versions (not latest)
deny[msg] {
    base_image := input.from[_]
    contains(base_image, ":latest")
    msg := sprintf("Image must not use :latest tag, got %s", [base_image])
}

# Require USER directive (not root)
deny[msg] {
    not input.user
    msg := sprintf("Dockerfile must define USER (not running as root)")
}

# ===== Custom Rules for Lux-Auto =====

# Require SLO documentation for new services
deny[msg] {
    resource := input.resource[_]
    resource.type == "kubernetes_service"
    not resource.metadata.annotations.slo_available
    msg := sprintf("Service %s must document SLOs in metadata annotation", [resource.metadata.name])
}

# Require ADR for database changes
deny[msg] {
    resource := input.resource[_]
    resource.type == "aws_db_instance"
    resource.changed == true
    not resource.adr_reference
    msg := sprintf("Database change must reference ADR (docs/adr/ADR-XXX)")
}

# ===== Rules as Code Tests =====

# Test: S3 bucket is private
test_s3_bucket_private {
    deny["S3 bucket must have acl=private"] with input as {
        "resource": [{
            "type": "aws_s3_bucket",
            "name": "my-bucket",
            "properties": {
                "acl": "public-read"
            }
        }]
    }
}

# Test: RDS has encryption
test_rds_encrypted {
    deny["RDS instance must have storage_encrypted=true"] with input as {
        "resource": [{
            "type": "aws_db_instance",
            "name": "prod-db",
            "storage_encrypted": false
        }]
    }
}
