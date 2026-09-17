import {
  DescribeInstancesCommand,
  EC2Client,
} from '@aws-sdk/client-ec2';
import {
  EntityProvider,
  EntityProviderConnection,
} from '@backstage/plugin-catalog-node';
import { Entity } from '@backstage/catalog-model';

export class AwsEc2EntityProvider implements EntityProvider {
  private connection?: EntityProviderConnection;

  getProviderName(): string {
    return 'aws-ec2';
  }

  async connect(connection: EntityProviderConnection): Promise<void> {
    this.connection = connection;
    await this.refresh();
  }

  async refresh(): Promise<void> {
    if (!this.connection) {
      throw new Error('AWS EC2 entity provider is not connected');
    }

    const ec2 = new EC2Client({});

    const response = await ec2.send(
      new DescribeInstancesCommand({
        Filters: [
          {
            Name: 'instance-state-name',
            Values: ['running'],
          },
          {
            Name: 'tag:ManagedBy',
            Values: ['Backstage'],
          },
        ],
      }),
    );

    const entities: Entity[] = [];

    for (const reservation of response.Reservations ?? []) {
      for (const instance of reservation.Instances ?? []) {
        if (!instance.InstanceId) {
          continue;
        }

        const tags = Object.fromEntries(
          (instance.Tags ?? [])
            .filter(tag => tag.Key)
            .map(tag => [tag.Key!, tag.Value ?? '']),
        );

        const instanceName =
          tags.Name || instance.InstanceId;

        entities.push({
          apiVersion: 'backstage.io/v1alpha1',
          kind: 'Resource',
          metadata: {
            name: instanceName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
            title: instanceName,
            description: `AWS EC2 instance ${instance.InstanceId}`,
            annotations: {
              'backstage.io/managed-by-location': 'aws-ec2:backstage',
              'backstage.io/managed-by-origin-location': 'aws-ec2:backstage',    		    
              'aws.amazon.com/instance-id': instance.InstanceId,
              'aws.amazon.com/region':
                instance.Placement?.AvailabilityZone?.slice(0, -1) ?? '',
              'aws.amazon.com/private-ip':
                instance.PrivateIpAddress ?? '',
              'aws.amazon.com/public-ip':
                instance.PublicIpAddress ?? '',
            },
            tags: [
              'aws',
              'ec2',
              'backstage-managed',
              ...(tags.Platform ? [tags.Platform.toLowerCase()] : []),
            ],
          },
          spec: {
            type: 'aws-ec2',
            lifecycle: 'production',
            owner:  'user:guest',
          },
        });
      }
    }

    await this.connection.applyMutation({
      type: 'full',
      entities: entities.map(entity => ({
        entity,
        locationKey: this.getProviderName(),
      })),
    });

    console.log(
      `[aws-ec2] Catalog discovery completed: ${entities.length} instance(s)`,
    );
  }
}
