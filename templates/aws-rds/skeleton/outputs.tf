output "database_identifier" {
  value = aws_db_instance.postgres.id
}

output "database_endpoint" {
  value = aws_db_instance.postgres.address
}

output "database_port" {
  value = aws_db_instance.postgres.port
}

output "database_name" {
  value = aws_db_instance.postgres.db_name
}

output "region" {
  value = var.region
}

output "environment" {
  value = var.environment
}
