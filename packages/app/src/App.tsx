import { createApp } from '@backstage/frontend-defaults';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import scaffolderPlugin from '@backstage/plugin-scaffolder/alpha';

import { navModule } from './modules/nav';
import { scaffolderCustomizations } from './components/scaffolder/scaffolderModule';
import { authSignInPageModule } from './modules/auth/signInPage';

export default createApp({
  features: [
    catalogPlugin,
    scaffolderPlugin,
    scaffolderCustomizations,
    navModule,
    authSignInPageModule,
  ],
});
