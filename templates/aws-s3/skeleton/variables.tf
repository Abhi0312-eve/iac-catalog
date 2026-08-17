variable "bucketName" {
  description = "S3 bucket name"
  type        = string
}

variable "region" {
  description = "AWS Region"
  type        = string
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
  description = "Owner of the S3 bucket"
  type        = string
}

variable "versioning" {
  description = "Enable S3 bucket versioning"
  type        = bool
  default     = true
}
