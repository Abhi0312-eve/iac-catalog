variable "aws_region" {
  default = "${{ values.awsRegion }}"
}

variable "instance_name" {
  default = "${{ values.vmName }}"
}

variable "instance_type" {
  default = "${{ values.instanceType }}"
}

variable "ami_id" {
  default = "${{ values.amiId }}"
}

variable "environment" {
  default = "${{ values.environment }}"
}

variable "owner" {
  default = "${{ values.owner }}"
}
