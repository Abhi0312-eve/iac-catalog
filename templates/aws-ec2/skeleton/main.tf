data "aws_ami" "amazon_linux" {
  most_recent = true

  owners = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }
}

resource "aws_instance" "ec2" {

  ami                    = data.aws_ami.amazon_linux.id
  instance_type          = var.instanceType

  tags = {
    Name = var.instanceName
    Owner = var.owner
  }
}
