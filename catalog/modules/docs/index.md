# AWS EC2 Terraform Module

## Overview

This is the internal AWS EC2 infrastructure implementation used by the Backstage AWS EC2 template.

The Backstage template collects the required EC2 configuration and generates a Terraform project that provisions an AWS EC2 instance.

## Current Version

**1.0.0**

## Provisioning Flow

Backstage AWS EC2 Template

→ Terraform project generation

→ GitHub repository

→ GitHub Actions

→ Terraform

→ AWS EC2

## Supported Configuration

The current implementation accepts:

- Instance name
- AWS region
- EC2 instance type
- Operating system / AMI
- Owner

## Terraform Implementation

The Terraform implementation currently consists of:

- `main.tf` — EC2 resource
- `provider.tf` — AWS provider configuration
- `variables.tf` — input variables
- `terraform.tfvars` — generated Terraform values
- `outputs.tf` — EC2 outputs

## Source

The source implementation is maintained in the organization's GitHub repository under:

`templates/aws-ec2/`

## Backstage Integration

This implementation is exposed through the Backstage template:

**AWS EC2 Instance**

The Backstage template collects the required inputs and generates the Terraform project.

## Ownership

Owner: Platform / Infrastructure Team

## Lifecycle

Production
