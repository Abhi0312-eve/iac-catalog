resource "aws_instance" "ec2" {
  ami           = var.operatingSystem
  instance_type = var.instanceType

  tags = {
    Name  = var.instanceName
    Owner = var.owner
  }
}

# AWS EC2 module baseline - v1.0.1-test

# AWS EC2 module release test v1.0.2

# Release test marker
