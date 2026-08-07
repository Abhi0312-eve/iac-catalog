ivariable "instanceName" {
  description = "EC2 Instance Name"
  type        = string
}

variable "region" {
  description = "AWS Region"
  type        = string
}

variable "instanceType" {
  description = "EC2 Instance Type"
  type        = string
}

variable "keyName" {
  description = "AWS Key Pair"
  type        = string
}

variable "securityGroupId" {
  description = "Security Group ID"
  type        = string
}
