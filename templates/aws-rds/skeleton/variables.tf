variable "databaseName" {
  description = "RDS PostgreSQL database identifier"
  type        = string
}

variable "region" {
  description = "AWS Region"
  type        = string
}

variable "instanceClass" {
  description = "RDS PostgreSQL instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "storage" {
  description = "Allocated storage in GB"
  type        = number
  default     = 20

  validation {
    condition     = var.storage >= 20
    error_message = "Storage must be at least 20 GB."
  }
}

variable "environment" {
  description = "Deployment environment"
  type        = string

  validation {
    condition = contains(
      ["dev", "test", "staging", "prod"],
      var.environment
    )

    error_message = "Environment must be dev, test, staging, or prod."
  }
}

variable "owner" {
  description = "Owner of the RDS database"
  type        = string
}

variable "dbSubnetGroupName" {
  description = "Existing RDS DB subnet group managed by the platform"
  type        = string
  default     = "default-vpc-0da802305383c0b6b"
}

variable "vpcId" {
  description = "Platform-managed VPC for Backstage RDS"
  type        = string
  default     = "vpc-0da802305383c0b6b"
}

variable "dbUsername" {
  description = "PostgreSQL master username"
  type        = string
  default     = "postgres"
}

variable "dbPassword" {
  description = "PostgreSQL master password"
  type        = string
  sensitive   = true
}
