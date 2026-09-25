import {
  createBackendPlugin,
  coreServices,
} from '@backstage/backend-plugin-api';
import express from 'express';
import fs from 'fs/promises';
import path from 'path';

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

        router.get(
          '/server-config/versions',
          async (_req, res) => {
            try {
              const serverConfigRoot = path.join(
                process.cwd(),
                'templates',
                'server-config',
              );

              const entries = await fs.readdir(
                serverConfigRoot,
                {
                  withFileTypes: true,
                },
              );

              const versions: Array<{ version: string }> = [];

              for (const entry of entries) {
                if (!entry.isDirectory()) {
                  continue;
                }

                const versionFile = path.join(
                  serverConfigRoot,
                  entry.name,
                  'VERSION',
                );

                try {
                  const version = (
                    await fs.readFile(
                      versionFile,
                      'utf8',
                    )
                  ).trim();

                  if (version) {
                    versions.push({
                      version: `v${version.replace(/^v/, '')}`,
                    });
                  }
                } catch {
                  // Ignore directories without a VERSION file.
                }
              }

              versions.sort((a, b) =>
                b.version.localeCompare(
                  a.version,
                  undefined,
                  {
                    numeric: true,
                    sensitivity: 'base',
                  },
                ),
              );

              res.json({
                versions,
                latest: versions[0]?.version ?? null,
              });
            } catch (error) {
              console.error(
                'Failed to discover server configuration versions:',
                error,
              );

              res.status(500).json({
                error:
                  'Failed to discover server configuration versions',
              });
            }
          },
        );

        router.get(
          '/server-config/services',
          async (req, res) => {
            try {
              const version = req.query.version;

              if (
                typeof version !== 'string' ||
                !version.trim()
              ) {
                res.status(400).json({
                  error:
                    'version query parameter is required',
                });
                return;
              }

              const normalizedVersion = version
                .trim()
                .replace(/^v/, '');

              const configFile = path.join(
                process.cwd(),
                'templates',
                'server-config',
                `v${normalizedVersion}`,
                'config.yaml',
              );

              const config = await fs.readFile(
                configFile,
                'utf8',
              );

              const services: Array<{
                name: string;
                title: string;
                description: string;
              }> = [];

              const lines = config.split(/\r?\n/);

              let currentService:
                | {
                    name: string;
                    title: string;
                    description: string;
                  }
                | null = null;

              for (const line of lines) {
                const nameMatch = line.match(
                  /^\s+-\s+name:\s*(.+)\s*$/,
                );

                if (nameMatch) {
                  if (currentService) {
                    services.push(currentService);
                  }

                  currentService = {
                    name: nameMatch[1].trim(),
                    title: '',
                    description: '',
                  };

                  continue;
                }

                if (!currentService) {
                  continue;
                }

                const titleMatch = line.match(
                  /^\s+title:\s*(.+)\s*$/,
                );

                if (titleMatch) {
                  currentService.title =
                    titleMatch[1].trim();
                  continue;
                }

                const descriptionMatch = line.match(
                  /^\s+description:\s*(.+)\s*$/,
                );

                if (descriptionMatch) {
                  currentService.description =
                    descriptionMatch[1].trim();
                }
              }

              if (currentService) {
                services.push(currentService);
              }

              res.json({
                version: `v${normalizedVersion}`,
                services,
              });
            } catch (error) {
              console.error(
                'Failed to load server configuration services:',
                error,
              );

              res.status(404).json({
                error:
                  'Server configuration version not found',
              });
            }
          },
        );

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
          path: '/server-config/versions',
          allow: 'unauthenticated',
        });

        httpRouter.addAuthPolicy({
          path: '/server-config/services',
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
