data "aws_security_group" "rds" {
  id = "sg-073cfdd5b2036a951"
}

resource "aws_db_instance" "postgres" {
  identifier = var.databaseName

  engine         = "postgres"
  instance_class = var.instanceClass

  allocated_storage = var.storage
  storage_type      = "gp3"
  storage_encrypted = true

  db_name  = replace(var.databaseName, "-", "_")
  username = var.dbUsername
  password = var.dbPassword

  db_subnet_group_name = var.dbSubnetGroupName
  vpc_security_group_ids = [
    data.aws_security_group.rds.id
  ]

  publicly_accessible = false

  backup_retention_period = 1
  deletion_protection     = false

  skip_final_snapshot = true

  tags = {
    Name        = var.databaseName
    Environment = var.environment
    Owner       = var.owner
    ManagedBy   = "Backstage"
  }
}
