import React from 'react';

import {
  Content,
  ContentHeader,
  Header,
  Page,
} from '@backstage/core-components';

import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from '@material-ui/core';

import RefreshIcon from '@material-ui/icons/Refresh';
import StorageIcon from '@material-ui/icons/Storage';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import ErrorIcon from '@material-ui/icons/Error';
import BuildIcon from '@material-ui/icons/Build';

type ManagedInstance = {
  instanceId: string;
  name: string;
  privateIp: string;
  publicIp: string;
  state: string;
  instanceType: string;
  platform: string;
  tags: Record<string, string>;
};

type ConfigService = {
  name: string;
  title: string;
  description: string;
  desired_state?: unknown;
};

type DriftResult = {
  status:
    | 'IN_SYNC'
    | 'DRIFTED'
    | 'ERROR'
    | 'REMEDIATED'
    | 'NOT_INSTALLED'
    | 'STARTED'
    | 'ALREADY_RUNNING';
  error?: string;
  message?: string;
  service_name?: string;
  details?: string;
  output?: string;
};

type ServerDriftState = {
  status: string;
  error?: string;
  details?: string;
  output?: string;
};

export const DriftDetectionPage = () => {
  const [instances, setInstances] = React.useState<ManagedInstance[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [versions, setVersions] = React.useState<string[]>([]);
  const [selectedVersion, setSelectedVersion] = React.useState('');
  const [services, setServices] = React.useState<ConfigService[]>([]);
  const [selectedService, setSelectedService] = React.useState('');
  const resultKey = (instanceId: string, serviceName: string) =>
  `${instanceId}::${serviceName}`;

  const [selectedInstances, setSelectedInstances] = React.useState<string[]>([]);
  const [driftResults, setDriftResults] = React.useState<
    Record<string, ServerDriftState>
  >({});

  const [checking, setChecking] = React.useState(false);
  const [remediatingInstances, setRemediatingInstances] = React.useState<
    string[]
  >([]);
  const [operationMessage, setOperationMessage] = React.useState('');
  const [serverFilter, setServerFilter] = React.useState('all');

  const loadInstances = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        '/api/aws/server-config/managed-servers',
      );

      if (!response.ok) {
        throw new Error(
          `Failed to load managed servers (${response.status})`,
        );
      }

      const data = await response.json();
      setInstances(data.instances ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load managed servers',
      );
    } finally {
      setLoading(false);
    }
  };

  const loadVersions = async () => {
    try {
      const response = await fetch(
        '/api/aws/server-config/versions',
      );

      if (!response.ok) {
        throw new Error(
          `Failed to load configuration versions (${response.status})`,
        );
      }

      const data = await response.json();
      const availableVersions: string[] = (data.versions ?? []).map(
        (item: { version: string }) => item.version,
      );

      setVersions(availableVersions);

      const initialVersion = data.latest || availableVersions[0] || '';
      setSelectedVersion(initialVersion);
    } catch (err) {
      setOperationMessage(
        err instanceof Error
          ? err.message
          : 'Failed to load configuration versions',
      );
    }
  };

  const loadServices = async (version: string) => {
    if (!version) {
      setServices([]);
      setSelectedService('');
      return;
    }

    try {
      const response = await fetch(
        `/api/aws/server-config/services?version=${encodeURIComponent(
          version,
        )}`,
      );

      if (!response.ok) {
        throw new Error(`Failed to load services (${response.status})`);
      }

      const data = await response.json();
      const availableServices: ConfigService[] = data.services ?? [];

      setServices(availableServices);

      const initialService =
        availableServices.find(service => service.desired_state)?.name ??
        '';

      setSelectedService(initialService);
      setDriftResults({});
    } catch (err) {
      setServices([]);
      setSelectedService('');
      setOperationMessage(
        err instanceof Error ? err.message : 'Failed to load services',
      );
    }
  };

  React.useEffect(() => {
    loadInstances();
    loadVersions();
  }, []);

  React.useEffect(() => {
    loadServices(selectedVersion);
  }, [selectedVersion]);

  const runningInstances = instances.filter(
    instance => instance.state === 'running',
  );

  const stoppedCount = instances.filter(
    instance =>
      instance.state === 'stopped' ||
      instance.state === 'stopping',
  ).length;

  const runningCount = runningInstances.length;

  const visibleInstances = instances.filter(instance => {
    if (serverFilter === 'running') {
      return instance.state === 'running';
    }

    if (serverFilter === 'stopped') {
      return (
        instance.state === 'stopped' ||
        instance.state === 'stopping'
      );
    }

    return true;
  });

  const toggleInstance = (instanceId: string) => {
    setSelectedInstances(previous =>
      previous.includes(instanceId)
        ? previous.filter(id => id !== instanceId)
        : [...previous, instanceId],
    );
  };

  const toggleAllRunning = () => {
    const allSelected = runningInstances.every(instance =>
      selectedInstances.includes(instance.instanceId),
    );

    if (allSelected) {
      setSelectedInstances(previous =>
        previous.filter(
          id =>
            !runningInstances.some(
              instance => instance.instanceId === id,
            ),
        ),
      );
    } else {
      setSelectedInstances(previous => [
        ...new Set([
          ...previous,
          ...runningInstances.map(instance => instance.instanceId),
        ]),
      ]);
    }
  };

  const checkDrift = async (
    instance: ManagedInstance,
    serviceName: string,
  ): Promise<DriftResult> => {
    const response = await fetch(
      '/api/aws/server-config/drift',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service: serviceName,
          version: selectedVersion,
          target: instance.instanceId,
        }),
      },
    );

    const data: DriftResult = await response.json();

    if (!response.ok) {
      throw new Error(
        data.details ||
          data.error ||
          `Drift check failed (${response.status})`,
      );
    }

    return data;
  };

  const runDriftChecks = async () => {
    const targets = instances.filter(
      instance =>
        selectedInstances.includes(instance.instanceId) &&
        instance.state === 'running',
    );

    const checkableServices = services.filter(
      service => service.desired_state,
    );

    if (!selectedVersion || !targets.length || !checkableServices.length) {
      setOperationMessage(
        'Select a configuration version, running server, and configured services.',
      );
      return;
    }

    setChecking(true);
    setOperationMessage('');

    try {
      for (const instance of targets) {
        for (const service of checkableServices) {
          const key = resultKey(instance.instanceId, service.name);

          setDriftResults(previous => ({
            ...previous,
            [key]: { status: 'CHECKING' },
          }));

          try {
            const result = await checkDrift(instance, service.name);

            setDriftResults(previous => ({
              ...previous,
              [key]: {
                status: result.status,
                error: result.error,
                details: result.details || result.message,
              },
            }));
          } catch (err) {
            setDriftResults(previous => ({
              ...previous,
              [key]: {
                status: 'ERROR',
                error:
                  err instanceof Error
                    ? err.message
                    : 'Drift check failed',
              },
            }));
          }
        }
      }

      setOperationMessage(
        'Drift checks completed for all configured services.',
      );
    } finally {
      setChecking(false);
    }
  };

  const remediateInstance = async (
    instance: ManagedInstance,
    service: ConfigService,
  ) => {
    const key = resultKey(instance.instanceId, service.name);
    const current = driftResults[key];

    if (
      current?.status !== 'DRIFTED' ||
      !service.desired_state ||
      instance.state !== 'running'
    ) {
      return;
    }

    setRemediatingInstances(previous => [...previous, key]);
    setOperationMessage('');

    try {
      const response = await fetch(
        '/api/aws/server-config/start-service',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            service: service.name,
            version: selectedVersion,
            target: instance.instanceId,
          }),
        },
      );

      const data: DriftResult = await response.json();

      if (data.status === 'NOT_INSTALLED') {
        setDriftResults(previous => ({
          ...previous,
          [key]: {
            status: 'NOT_INSTALLED',
            error:
              data.message ||
              data.error ||
              'Service is not installed. Install it using Server Configuration Management.',
            details: data.details,
          },
        }));

        setOperationMessage(
          data.message ||
            'Service is not installed. Install it using Server Configuration Management.',
        );
        return;
      }

      if (
        !response.ok ||
        (data.status !== 'STARTED' &&
          data.status !== 'ALREADY_RUNNING')
      ) {
        throw new Error(
          data.details ||
            data.error ||
            `Service start failed (${response.status})`,
        );
      }

      setDriftResults(previous => ({
        ...previous,
        [key]: {
          status: 'REMEDIATED',
          output: data.output,
        },
      }));

      const verification = await checkDrift(instance, service.name);

      setDriftResults(previous => ({
        ...previous,
        [key]: {
          status: verification.status,
          error: verification.error,
          details: verification.details || verification.message,
          output: data.output,
        },
      }));

      setOperationMessage(
        `${service.title || service.name} remediation and verification completed for ${instance.name}.`,
      );
    } catch (err) {
      setDriftResults(previous => ({
        ...previous,
        [key]: {
          status: 'ERROR',
          error:
            err instanceof Error
              ? err.message
              : 'Remediation or verification failed',
        },
      }));
    } finally {
      setRemediatingInstances(previous =>
        previous.filter(id => id !== key),
      );
    }
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'IN_SYNC':
        return 'In Sync';
      case 'DRIFTED':
        return 'Drift Detected';
      case 'ERROR':
        return 'Error';
      case 'CHECKING':
        return 'Checking...';
      case 'REMEDIATED':
        return 'Remediated';
      case 'NOT_INSTALLED':
        return 'Not Installed';
      case 'STARTED':
        return 'Started';
      case 'ALREADY_RUNNING':
        return 'Already Running';
      default:
        return 'Not verified';
    }
  };

  const getStatusColor = (
    status?: string,
  ): 'default' | 'primary' | 'secondary' => {
    if (status === 'IN_SYNC') {
      return 'primary';
    }

    if (status === 'DRIFTED' || status === 'ERROR') {
      return 'secondary';
    }

    return 'default';
  };

  return (
    <Page themeId="tool">
      <Header
        title="Drift Detection"
        subtitle="Monitor configuration health of managed infrastructure"
      />

      <Content>
        <ContentHeader>
          <Box
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            width="100%"
          >
            <Box>
              <Typography variant="h5" gutterBottom>
                Configuration Health
              </Typography>

              <Typography variant="body2" color="textSecondary">
                Review and remediate configuration drift on your
                Backstage-managed servers.
              </Typography>
            </Box>

            <IconButton
              aria-label="Refresh"
              title="Refresh"
              size="small"
              onClick={loadInstances}
              disabled={
                loading ||
                checking ||
                remediatingInstances.length > 0
              }
            >
              <RefreshIcon />
            </IconButton>
          </Box>
        </ContentHeader>

        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center">
                  <StorageIcon color="primary" />
                  <Box ml={2}>
                    <Typography
                      variant="body2"
                      color="textSecondary"
                    >
                      Managed Servers
                    </Typography>
                    <Typography variant="h4">
                      {loading ? '—' : instances.length}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center">
                  <CheckCircleIcon color="primary" />
                  <Box ml={2}>
                    <Typography
                      variant="body2"
                      color="textSecondary"
                    >
                      Running
                    </Typography>
                    <Typography variant="h4">
                      {loading ? '—' : runningCount}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center">
                  <ErrorIcon color="error" />
                  <Box ml={2}>
                    <Typography
                      variant="body2"
                      color="textSecondary"
                    >
                      Stopped
                    </Typography>
                    <Typography variant="h4">
                      {loading ? '—' : stoppedCount}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Box mt={4}>
          <Card>
            <CardContent>
              <Box mb={3}>
                <Typography variant="h6">
                  Configuration Controls
                </Typography>
                <Typography
                  variant="body2"
                  color="textSecondary"
                >
                  Select the configuration and servers to check all configured services.
                </Typography>
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <FormControl
                    variant="outlined"
                    fullWidth
                    disabled={
                      versions.length === 0 ||
                      checking ||
                      remediatingInstances.length > 0
                    }
                  >
                    <InputLabel id="config-version-label">
                      Configuration Version
                    </InputLabel>

                    <Select
                      labelId="config-version-label"
                      value={selectedVersion}
                      onChange={event =>
                        setSelectedVersion(event.target.value as string)
                      }
                      label="Configuration Version"
                    >
                      {versions.map(version => (
                        <MenuItem key={version} value={version}>
                          {version}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControl
                    variant="outlined"
                    fullWidth
                    disabled={
                      services.length === 0 ||
                      checking ||
                      remediatingInstances.length > 0
                    }
                  >
                    <InputLabel id="config-service-label">
                      Service
                    </InputLabel>

                    <Select
                      labelId="config-service-label"
                      value={selectedService}
                      onChange={event => {
                        setSelectedService(event.target.value as string);
                        setDriftResults({});
                      }}
                      label="Service"
                    >
                      {services.map(service => (
                        <MenuItem
                          key={service.name}
                          value={service.name}
                        >
                          {service.title || service.name}
                          {!service.desired_state
                            ? ' (not configured for remediation)'
                            : ''}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              <Box
                mt={2}
                display="flex"
                alignItems="center"
                flexWrap="wrap"
              >
                <FormControlLabel
                  control={
                    <Checkbox
                      color="primary"
                      checked={
                        runningInstances.length > 0 &&
                        runningInstances.every(instance =>
                          selectedInstances.includes(instance.instanceId),
                        )
                      }
                      indeterminate={
                        runningInstances.some(instance =>
                          selectedInstances.includes(instance.instanceId),
                        ) &&
                        !runningInstances.every(instance =>
                          selectedInstances.includes(instance.instanceId),
                        )
                      }
                      onChange={toggleAllRunning}
                      disabled={
                        runningInstances.length === 0 ||
                        checking ||
                        remediatingInstances.length > 0
                      }
                    />
                  }
                  label="Select all running servers"
                />

                <Box flexGrow={1} />

                <Button
                  variant="contained"
                  color="primary"
                  onClick={runDriftChecks}
                  disabled={
                    checking ||
                    remediatingInstances.length > 0 ||
                    !selectedVersion ||
                    !services.some(service => service.desired_state) ||
                    !selectedInstances.some(id =>
                      runningInstances.some(
                        instance => instance.instanceId === id,
                      ),
                    )
                  }
                >
                  {checking ? 'Checking...' : 'Check Drift'}
                </Button>
              </Box>

              {operationMessage && (
                <Box mt={2}>
                  <Typography variant="body2" color="textSecondary">
                    {operationMessage}
                  </Typography>
                </Box>
              )}

            </CardContent>
          </Card>
        </Box>

        <Box mt={4}>
          <Card>
            <CardContent>
              <Box
                display="flex"
                alignItems="center"
                justifyContent="space-between"
                mb={3}
              >
                <Box>
                  <Typography variant="h6">
                    Managed Infrastructure
                  </Typography>
                  <Typography
                    variant="body2"
                    color="textSecondary"
                  >
                    EC2 servers created and managed through Backstage.
                  </Typography>
                </Box>

                <FormControl variant="outlined" size="small">
                  <Select
                    value={serverFilter}
                    onChange={event =>
                      setServerFilter(event.target.value as string)
                    }
                    style={{ minWidth: 150 }}
                  >
                    <MenuItem value="all">All Servers</MenuItem>
                    <MenuItem value="running">Running</MenuItem>
                    <MenuItem value="stopped">Stopped</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              {loading && (
                <Box
                  border={1}
                  borderColor="divider"
                  borderRadius={8}
                  p={3}
                >
                  <Typography color="textSecondary">
                    Loading managed servers...
                  </Typography>
                </Box>
              )}

              {!loading && error && (
                <Box
                  border={1}
                  borderColor="error.main"
                  borderRadius={8}
                  p={3}
                >
                  <Typography color="error">{error}</Typography>
                </Box>
              )}

              {!loading && !error && instances.length === 0 && (
                <Box
                  border={1}
                  borderColor="divider"
                  borderRadius={8}
                  p={3}
                >
                  <Typography variant="subtitle1">
                    No managed servers found
                  </Typography>
                  <Typography
                    variant="body2"
                    color="textSecondary"
                  >
                    No running or stopped EC2 instances currently have
                    ManagedBy=Backstage.
                  </Typography>
                </Box>
              )}

              {!loading &&
                !error &&
                visibleInstances.map(instance => {
                  const isRunning = instance.state === 'running';
                  return (
                    <Box
                      key={instance.instanceId}
                      border={1}
                      borderColor="divider"
                      borderRadius={8}
                      p={3}
                      mb={2}
                    >
                      <Box
                        display="flex"
                        alignItems="center"
                        justifyContent="space-between"
                      >
                        <Box display="flex" alignItems="center">
                          <Checkbox
                            color="primary"
                            checked={selectedInstances.includes(
                              instance.instanceId,
                            )}
                            onChange={() =>
                              toggleInstance(instance.instanceId)
                            }
                            disabled={
                              !isRunning ||
                              checking ||
                              remediatingInstances.length > 0
                            }
                          />

                          <Box
                            width={10}
                            height={10}
                            borderRadius="50%"
                            bgcolor={
                              isRunning ? 'success.main' : 'error.main'
                            }
                            mr={2}
                          />

                          <Box>
                            <Typography variant="subtitle1">
                              {instance.name}
                            </Typography>
                            <Typography
                              variant="body2"
                              color="textSecondary"
                            >
                              {instance.privateIp ||
                                'Private IP unavailable'}
                              {' • '}
                              {instance.instanceId}
                            </Typography>
                          </Box>
                        </Box>

                        <Chip
                          label={
                            isRunning ? 'Instance Running' : instance.state
                          }
                          size="small"
                          color={isRunning ? 'primary' : 'default'}
                        />
                      </Box>

                      <Box
                        mt={3}
                        pt={2}
                        borderTop={1}
                        borderColor="divider"
                      >
                        {services
                          .filter(service => service.desired_state)
                          .map(service => {
                            const key = resultKey(
                              instance.instanceId,
                              service.name,
                            );
                            const result = driftResults[key];
                            const isRemediating =
                              remediatingInstances.includes(key);

                            const canRemediate =
                              result?.status === 'DRIFTED' &&
                              isRunning &&
                              !checking &&
                              !isRemediating &&
                              remediatingInstances.length === 0;

                            return (
                              <Box
                                key={service.name}
                                py={2}
                                borderBottom={1}
                                borderColor="divider"
                              >
                                <Box
                                  display="flex"
                                  alignItems="center"
                                  justifyContent="space-between"
                                  flexWrap="wrap"
                                >
                                  <Box display="flex" alignItems="center">
                                    <BuildIcon
                                      fontSize="small"
                                      color="disabled"
                                    />

                                    <Box ml={1}>
                                      <Typography variant="body2">
                                        {service.title || service.name}
                                      </Typography>

                                      <Typography
                                        variant="caption"
                                        color="textSecondary"
                                      >
                                        {result?.error ||
                                          result?.details ||
                                          (result?.status === 'IN_SYNC'
                                            ? 'Configuration matches the desired state.'
                                            : result?.status === 'DRIFTED'
                                            ? 'Configuration differs from the desired state.'
                                            : result?.status === 'CHECKING'
                                            ? 'Checking configuration...'
                                            : result?.status === 'ERROR'
                                            ? 'The configuration check or operation failed.'
                                            : result?.status === 'NOT_INSTALLED'
                                            ? 'Required package is not installed.'
                                            : 'Run a drift check to verify this service.')}
                                      </Typography>
                                    </Box>
                                  </Box>

                                  <Box
                                    display="flex"
                                    alignItems="center"
                                    gridGap={8}
                                    flexWrap="wrap"
                                  >
                                    <Chip
                                      label={getStatusLabel(result?.status)}
                                      size="small"
                                      color={getStatusColor(result?.status)}
                                      variant="outlined"
                                    />

                                    {canRemediate && (
                                      <Button
                                        variant="contained"
                                        color="secondary"
                                        size="small"
                                        onClick={() =>
                                          remediateInstance(instance, service)
                                        }
                                      >
                                        Remediate
                                      </Button>
                                    )}

                                    {isRemediating && (
                                      <Button
                                        variant="outlined"
                                        size="small"
                                        disabled
                                      >
                                        Remediating...
                                      </Button>
                                    )}
                                  </Box>
                                </Box>

                                {result?.output && (
                                  <Box mt={2}>
                                    <Typography
                                      variant="caption"
                                      color="textSecondary"
                                    >
                                      Remediation output
                                    </Typography>

                                    <Box
                                      mt={1}
                                      p={1}
                                      border={1}
                                      borderColor="divider"
                                      borderRadius={4}
                                      style={{
                                        maxHeight: 160,
                                        overflow: 'auto',
                                        whiteSpace: 'pre-wrap',
                                        overflowWrap: 'anywhere',
                                      }}
                                    >
                                      <Typography variant="caption">
                                        {result.output}
                                      </Typography>
                                    </Box>
                                  </Box>
                                )}
                              </Box>
                            );
                          })}
                      </Box>

                      <Box mt={2}>
                        <Typography
                          variant="caption"
                          color="textSecondary"
                        >
                          {instance.instanceType}
                          {' • '}
                          {instance.platform}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })}
            </CardContent>
          </Card>
        </Box>
      </Content>
    </Page>
  );
};
