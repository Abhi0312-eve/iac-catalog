import { createFrontendModule } from '@backstage/frontend-plugin-api';
import {
  FormFieldBlueprint,
  createFormField,
} from '@backstage/plugin-scaffolder-react/alpha';

import { AwsRegionPicker } from './AwsRegionPicker';
import { AwsInstanceTypePicker } from './AwsInstanceTypePicker';
import { AwsOperatingSystemPicker } from './AwsOperatingSystemPicker';
import { ModuleVersionPicker } from './ModuleVersionPicker';
import { ModuleStorageSizePicker } from './ModuleStorageSizePicker';
import { ServerConfigVersionPicker } from './ServerConfigVersionPicker';
import { TargetEc2Picker } from './TargetEc2Picker';
import { ServicePicker } from './ServicePicker';

export const scaffolderCustomizations = createFrontendModule({
  pluginId: 'scaffolder',
  extensions: [
    FormFieldBlueprint.make({
      name: 'ModuleVersionPicker',
      params: {
        field: () =>
          Promise.resolve(
            createFormField({
              name: 'ModuleVersionPicker',
              component: ModuleVersionPicker,
            }),
          ),
      },
    }),

    FormFieldBlueprint.make({
      name: 'ModuleStorageSizePicker',
      params: {
        field: () =>
          Promise.resolve(
            createFormField({
              name: 'ModuleStorageSizePicker',
              component: ModuleStorageSizePicker,
            }),
          ),
      },
    }),

    FormFieldBlueprint.make({
      name: 'AwsRegionPicker',
      params: {
        field: () =>
          Promise.resolve(
            createFormField({
              name: 'AwsRegionPicker',
              component: AwsRegionPicker,
            }),
          ),
      },
    }),

    FormFieldBlueprint.make({
      name: 'AwsInstanceTypePicker',
      params: {
        field: () =>
          Promise.resolve(
            createFormField({
              name: 'AwsInstanceTypePicker',
              component: AwsInstanceTypePicker,
            }),
          ),
      },
    }),

    FormFieldBlueprint.make({
      name: 'AwsOperatingSystemPicker',
      params: {
        field: () =>
          Promise.resolve(
            createFormField({
              name: 'AwsOperatingSystemPicker',
              component: AwsOperatingSystemPicker,
            }),
          ),
      },
    }),

    FormFieldBlueprint.make({
      name: 'ServerConfigVersionPicker',
      params: {
        field: () =>
          Promise.resolve(
            createFormField({
              name: 'ServerConfigVersionPicker',
              component: ServerConfigVersionPicker,
            }),
          ),
      },
    }),

    FormFieldBlueprint.make({
      name: 'ServicePicker',
      params: {
        field: () =>
          Promise.resolve(
            createFormField({
              name: 'ServicePicker',
              component: ServicePicker,
            }),
          ),
      },
    }),

    FormFieldBlueprint.make({
      name: 'TargetEc2Picker',
      params: {
        field: () =>
          Promise.resolve(
            createFormField({
              name: 'TargetEc2Picker',
              component: TargetEc2Picker,
            }),
          ),
      },
    }),
  ],
});
