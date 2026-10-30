import {
  createFrontendPlugin,
  createRouteRef,
  PageBlueprint,
} from '@backstage/frontend-plugin-api';
import WarningIcon from '@material-ui/icons/Warning';

const driftDetectionRouteRef = createRouteRef();

const driftDetectionPage = PageBlueprint.make({
  params: {
    routeRef: driftDetectionRouteRef,
    path: '/drift-detection',
    title: 'Drift Detection',
    icon: <WarningIcon />,
    loader: () =>
      import('./DriftDetectionPage').then(m => <m.DriftDetectionPage />),
  },
});

export const driftDetectionPlugin = createFrontendPlugin({
  pluginId: 'drift-detection',
  extensions: [driftDetectionPage],
});
