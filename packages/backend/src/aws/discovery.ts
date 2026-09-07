import {
  EC2Client,
  DescribeRegionsCommand,
  DescribeImagesCommand,
  DescribeInstanceTypesCommand,
} from '@aws-sdk/client-ec2';

const ec2 = new EC2Client({});

export async function getAwsRegions() {
  const response = await ec2.send(
    new DescribeRegionsCommand({
      AllRegions: false,
    }),
  );

  return (response.Regions ?? [])
    .map(region => region.RegionName)
    .filter((region): region is string => Boolean(region))
    .sort();
}

function getFriendlyAmiName(name: string): string | null {
  const lowerName = name.toLowerCase();

  /*
   * Ubuntu
   *
   * Examples:
   * ubuntu/images/hvm-ssd-gp3/ubuntu-jammy-22.04-amd64-server-...
   * ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-...
   * ubuntu/images/hvm-ssd-gp3/ubuntu-resolute-26.04-amd64-server-...
   */
  if (lowerName.startsWith('ubuntu/')) {
    const versionMatch = name.match(/ubuntu-[a-z]+-([0-9]+\.[0-9]+)/i);

    if (versionMatch) {
      return `Ubuntu ${versionMatch[1]}`;
    }

    return 'Ubuntu Linux';
  }

  /*
   * Amazon Linux 2023
   *
   * We deliberately normalize all AL2023 variants:
   *
   * al2023-ami-...
   * al2023-ami-minimal-...
   * al2023-ami-ecs-...
   * al2023-ami-ecs-neuron-...
   *
   * This prevents dozens of identical "Amazon Linux 2023"
   * entries from appearing in the UI.
   */
  if (lowerName.startsWith('al2023-ami-')) {
    return 'Amazon Linux 2023';
  }

  /*
   * RHEL
   *
   * Examples:
   * RHEL-8.10.0_HVM-...
   * RHEL-9.8.0_HVM-...
   * RHEL-10.2.0_HVM-...
   */
  if (lowerName.startsWith('rhel-')) {
    const versionMatch = name.match(/^RHEL-([0-9]+\.[0-9]+)/i);

    if (versionMatch) {
      return `Red Hat Enterprise Linux ${versionMatch[1]}`;
    }

    return 'Red Hat Enterprise Linux';
  }

  /*
   * SUSE
   *
   * Examples:
   * suse-sles-15-sp7-...
   * suse-sles-16-0-...
   * suse-sles-15-sp7-sapcal-...
   */
  if (lowerName.startsWith('suse-sles-')) {
    const versionMatch = name.match(/^suse-sles-([0-9]+)(?:-sp([0-9]+))?/i);

    if (versionMatch) {
      const majorVersion = versionMatch[1];
      const servicePack = versionMatch[2];

      if (servicePack) {
        return `SUSE Linux Enterprise Server ${majorVersion} SP${servicePack}`;
      }

      return `SUSE Linux Enterprise Server ${majorVersion}`;
    }

    return 'SUSE Linux Enterprise Server';
  }

  return null;
}

export async function getAwsAmis(region: string) {
  const client = new EC2Client({ region });

  const response = await client.send(
    new DescribeImagesCommand({
      Owners: [
        '099720109477', // Ubuntu
        'amazon',       // Amazon Linux
        '309956199498', // Red Hat
        '013907871322', // SUSE
      ],

      Filters: [
        {
          Name: 'state',
          Values: ['available'],
        },
        {
          Name: 'architecture',
          Values: ['x86_64'],
        },
        {
          Name: 'root-device-type',
          Values: ['ebs'],
        },
        {
          Name: 'name',
          Values: [
            'ubuntu/images/hvm-ssd-gp3/*-amd64-server-*',
            'al2023-ami-*',
            'RHEL-*',
            'suse-sles-*',
          ],
        },
      ],
    }),
  );

  /*
   * Convert AWS AMI names into friendly names.
   */
  const normalizedImages = (response.Images ?? [])
    .filter(image => image.ImageId && image.Name)
    .map(image => ({
      id: image.ImageId!,
      originalName: image.Name!,
      friendlyName: getFriendlyAmiName(image.Name!),
      creationDate: image.CreationDate,
    }))
    .filter(image => image.friendlyName !== null);

  /*
   * Keep only the newest AMI for each friendly OS/version.
   *
   * This is especially important for Amazon Linux 2023 because AWS
   * publishes many AL2023 AMIs with different internal variants.
   *
   * Example:
   *
   * Amazon Linux 2023
   *   ami-xxxx
   *   ami-yyyy
   *   ami-zzzz
   *
   * becomes only:
   *
   * Amazon Linux 2023
   */
  const newestByOs = new Map<
    string,
    {
      id: string;
      originalName: string;
      friendlyName: string;
      creationDate: string | undefined;
    }
  >();

  for (const image of normalizedImages) {
    const friendlyName = image.friendlyName;

    if (!friendlyName) {
      continue;
    }

    const existing = newestByOs.get(friendlyName);

    if (
      !existing ||
      (image.creationDate ?? '') > (existing.creationDate ?? '')
    ) {
      newestByOs.set(friendlyName, {
        id: image.id,
        originalName: image.originalName,
        friendlyName,
        creationDate: image.creationDate,
      });
    }
  }

  /*
   * Return newest AMIs sorted by friendly OS name.
   */
  return Array.from(newestByOs.values())
    .sort((a, b) => a.friendlyName.localeCompare(b.friendlyName))
    .map(image => ({
      id: image.id,
      name: image.friendlyName,
      originalName: image.originalName,
      creationDate: image.creationDate,
    }));
}

export async function getAwsInstanceTypes(region: string) {
  const client = new EC2Client({ region });

  const instanceTypes: string[] = [];
  let nextToken: string | undefined;

  do {
    const response = await client.send(
      new DescribeInstanceTypesCommand({
        Filters: [
          {
            Name: 'processor-info.supported-architecture',
            Values: ['x86_64'],
          },
        ],
        NextToken: nextToken,
      }),
    );

    for (const instanceType of response.InstanceTypes ?? []) {
      if (instanceType.InstanceType) {
        instanceTypes.push(instanceType.InstanceType);
      }
    }

    nextToken = response.NextToken;
  } while (nextToken);

  return instanceTypes.sort();
}
