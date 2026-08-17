output "bucket_name" {
  description = "S3 bucket name"
  value       = aws_s3_bucket.bucket.bucket
}

output "bucket_arn" {
  description = "S3 bucket ARN"
  value       = aws_s3_bucket.bucket.arn
}

output "region" {
  description = "AWS region"
  value       = var.region
}

output "environment" {
  description = "Deployment environment"
  value       = var.environment
}
