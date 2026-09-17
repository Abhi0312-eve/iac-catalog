import {
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';
import { catalogProcessingExtensionPoint } from '@backstage/plugin-catalog-node';
import { AwsEc2EntityProvider } from './ec2EntityProvider';

const catalogModuleAwsEc2 = createBackendModule({
  pluginId: 'catalog',
  moduleId: 'aws-ec2',

  register(env) {
    env.registerInit({
      deps: {
        catalog: catalogProcessingExtensionPoint,
        scheduler: coreServices.scheduler,
      },

      async init({ catalog, scheduler }) {
        const provider = new AwsEc2EntityProvider();

        catalog.addEntityProvider(provider);

        await scheduler.scheduleTask({
          id: 'aws-ec2-discovery',
          frequency: { minutes: 5 },
          timeout: { minutes: 2 },
          fn: async () => {
            await provider.refresh();
          },
        });
      },
    });
  },
});

export default catalogModuleAwsEc2;
