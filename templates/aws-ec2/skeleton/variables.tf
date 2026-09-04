variable "instanceName" {
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

variable "operatingSystem" {
  type = string
}

variable "owner" {
  type = string
}

variable "storageSize" {
  description = "EC2 root volume size in GB"
  type        = number
}
