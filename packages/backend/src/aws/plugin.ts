import {
  createBackendPlugin,
  coreServices,
} from '@backstage/backend-plugin-api';
import express from 'express';

import {
  getAwsAmis,
  getAwsRegions,
  getAwsInstanceTypes,
} from './discovery';
import { awsOptions } from './options';

const awsPlugin = createBackendPlugin({
  pluginId: 'aws',

  register(reg) {
    reg.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        config: coreServices.rootConfig,
      },

      async init({ httpRouter }) {
        const router = express.Router();

        router.get('/module-versions', async (_req, res) => {
          try {
            const token = process.env.GITHUB_TOKEN;

            if (!token) {
              throw new Error('GitHub token is not configured');
            }

            const response = await fetch(
              'https://api.github.com/repos/Abhi0312-eve/iac-catalog/releases?per_page=100',
              {
                headers: {
                  Accept: 'application/vnd.github+json',
                  Authorization: `Bearer ${token}`,
                  'X-GitHub-Api-Version': '2022-11-28',
                },
              },
            );

            if (!response.ok) {
              throw new Error(
                `GitHub API returned ${response.status}`,
              );
            }

            const releases = (await response.json()) as Array<{
              tag_name?: string;
              draft?: boolean;
              prerelease?: boolean;
            }>;

            const moduleVersions = [];

            for (const release of releases) {
              if (
                !release.tag_name?.startsWith('aws-ec2-v') ||
                release.draft ||
                release.prerelease
              ) {
                continue;
              }

              const version = release.tag_name.replace(
                'aws-ec2-',
                '',
              );

              const variablesResponse = await fetch(
                `https://api.github.com/repos/Abhi0312-eve/iac-catalog/contents/templates/aws-ec2/skeleton/variables.tf?ref=${release.tag_name}`,
                {
                  headers: {
                    Accept: 'application/vnd.github+json',
                    Authorization: `Bearer ${token}`,
                    'X-GitHub-Api-Version': '2022-11-28',
                  },
                },
              );

              let supportsStorage = false;

              if (variablesResponse.ok) {
                const variablesData =
                  (await variablesResponse.json()) as {
                    content?: string;
                    encoding?: string;
                  };

                if (variablesData.content) {
                  const variablesContent = Buffer.from(
                    variablesData.content.replace(/\n/g, ''),
                    'base64',
                  ).toString('utf8');

                  supportsStorage =
                    variablesContent.includes(
                      'variable "storageSize"',
                    );
                }
              }

              moduleVersions.push({
                version,
                supportsStorage,
              });
            }

            moduleVersions.sort((a, b) =>
              b.version.localeCompare(a.version, undefined, {
                numeric: true,
                sensitivity: 'base',
              }),
            );

            res.json({
              versions: moduleVersions,
              latest: moduleVersions[0]?.version ?? null,
            });
          } catch (error) {
            console.error(
              'Failed to discover AWS EC2 module versions:',
              error,
            );

            res.status(500).json({
              error: 'Failed to discover AWS EC2 module versions',
            });
          }
        });

        router.get('/regions', async (_req, res) => {
          try {
            const regions = await getAwsRegions();
            res.json({ regions });
          } catch (error) {
            console.error('Failed to discover AWS regions:', error);
            res.status(500).json({
              error: 'Failed to discover AWS regions',
            });
          }
        });

        router.get('/amis', async (req, res) => {
          try {
            const region = req.query.region;

            if (typeof region !== 'string' || !region.trim()) {
              res.status(400).json({
                error: 'region query parameter is required',
              });
              return;
            }

            const amis = await getAwsAmis(region);
            res.json({ amis });
          } catch (error) {
            console.error('Failed to discover AWS AMIs:', error);
            res.status(500).json({
              error: 'Failed to discover AWS AMIs',
            });
          }
        });

        router.get('/options', async (req, res) => {
          const region = req.query.region;

          if (typeof region !== 'string' || !region.trim()) {
            res.status(400).json({
              error: 'region query parameter is required',
            });
            return;
          }

          const options =
            awsOptions[region as keyof typeof awsOptions];

          if (!options) {
            res.status(404).json({
              error: 'Unsupported AWS region',
            });
            return;
          }

          res.json(options);
        });

        router.get('/instance-types', async (req, res) => {
          try {
            const region = req.query.region;

            if (typeof region !== 'string' || !region.trim()) {
              res.status(400).json({
                error: 'region query parameter is required',
              });
              return;
            }

            const instanceTypes = await getAwsInstanceTypes(region);

            res.json({ instanceTypes });
          } catch (error) {
            console.error(
              'Failed to discover AWS instance types:',
              error,
            );

            res.status(500).json({
              error: 'Failed to discover AWS instance types',
            });
          }
        });

        httpRouter.addAuthPolicy({
          path: '/module-versions',
          allow: 'unauthenticated',
        });

        httpRouter.addAuthPolicy({
          path: '/regions',
          allow: 'unauthenticated',
        });

        httpRouter.addAuthPolicy({
          path: '/amis',
          allow: 'unauthenticated',
        });

        httpRouter.addAuthPolicy({
          path: '/options',
          allow: 'unauthenticated',
        });

        httpRouter.addAuthPolicy({
          path: '/instance-types',
          allow: 'unauthenticated',
        });

        httpRouter.use(
          router as unknown as Parameters<typeof httpRouter.use>[0],
        );
      },
    });
  },
});

export default awsPlugin;
