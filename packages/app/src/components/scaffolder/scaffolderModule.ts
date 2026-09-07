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
  ],
});
