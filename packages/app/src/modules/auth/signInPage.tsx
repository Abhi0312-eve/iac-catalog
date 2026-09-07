import { SignInPage } from '@backstage/core-components';
import { SignInPageProps, SignInPageBlueprint } from '@backstage/plugin-app-react';
import {
  createFrontendModule,
  microsoftAuthApiRef,
} from '@backstage/frontend-plugin-api';

const SignInPageComponent = (props: SignInPageProps) => (
  <SignInPage
    {...props}
    title="Sign in to Backstage"
    providers={[
      {
        id: 'microsoft',
        title: 'Microsoft',
        message: 'Sign in with your organization account',
        apiRef: microsoftAuthApiRef,
      },
      'guest',
    ]}
  />
);

export const authSignInPageModule = createFrontendModule({
  pluginId: 'app',
  extensions: [
    SignInPageBlueprint.make({
      params: {
        loader: async () => SignInPageComponent,
      },
    }),
  ],
});
