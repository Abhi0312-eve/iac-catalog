export const awsOptions = {
  'us-east-1': {
    instanceTypes: [
      't3.micro',
      't3.small',
      't3.medium',
      't3.large',
    ],
    operatingSystems: [
      'Amazon Linux 2023',
      'Ubuntu 24.04',
      'Ubuntu 22.04',
      'RHEL 9',
      'RHEL 8',
      'Rocky Linux 9',
      'AlmaLinux 9',
    ],
  },

  'us-east-2': {
    instanceTypes: [
      't3.micro',
      't3.small',
      't3.medium',
      't3.large',
    ],
    operatingSystems: [
      'Amazon Linux 2023',
      'Ubuntu 24.04',
      'Ubuntu 22.04',
      'RHEL 9',
      'RHEL 8',
      'Rocky Linux 9',
      'AlmaLinux 9',
    ],
  },

  'ap-south-1': {
    instanceTypes: [
      't3.micro',
      't3.small',
      't3.medium',
      't3.large',
    ],
    operatingSystems: [
      'Amazon Linux 2023',
      'Ubuntu 24.04',
      'Ubuntu 22.04',
      'RHEL 9',
      'RHEL 8',
      'Rocky Linux 9',
      'AlmaLinux 9',
    ],
  },
} as const;
