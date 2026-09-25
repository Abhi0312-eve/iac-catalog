import { useEffect, useState } from 'react';
import {
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  FormHelperText,
} from '@material-ui/core';
import { useApi } from '@backstage/core-plugin-api';
import {
  catalogApiRef,
} from '@backstage/plugin-catalog-react';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';

interface Ec2Instance {
  name: string;
  instanceId: string;
}

export const TargetEc2Picker = ({
  onChange,
  rawErrors,
  formData,
}: FieldExtensionComponentProps<string>) => {
  const catalogApi = useApi(catalogApiRef);

  const [instances, setInstances] = useState<Ec2Instance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState(
    formData ?? '',
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadInstances = async () => {
      try {
        const response = await catalogApi.getEntities({
          filter: {
            kind: 'Resource',
            'spec.type': 'aws-ec2',
          },
        });

        const discoveredInstances: Ec2Instance[] = response.items
          .map(entity => {
            const instanceId =
              entity.metadata.annotations?.[
                'aws.amazon.com/instance-id'
              ];

            if (!instanceId) {
              return null;
            }

            return {
              name:
                entity.metadata.title ??
                entity.metadata.name,
              instanceId,
            };
          })
          .filter(
            (instance): instance is Ec2Instance =>
              instance !== null,
          );

        discoveredInstances.sort((a, b) =>
          a.name.localeCompare(b.name),
        );

        setInstances(discoveredInstances);

        if (!formData && discoveredInstances.length === 1) {
          setSelectedInstance(
            discoveredInstances[0].instanceId,
          );
          onChange(discoveredInstances[0].instanceId);
        }
      } catch (err) {
        console.error(
          'Failed to load EC2 instances from Backstage Catalog:',
          err,
        );

        setError('Unable to load EC2 instances');
      } finally {
        setLoading(false);
      }
    };

    loadInstances();
  }, [catalogApi, formData, onChange]);

  useEffect(() => {
    if (formData !== undefined) {
      setSelectedInstance(formData);
    }
  }, [formData]);

  const handleChange = (value: string) => {
    setSelectedInstance(value);
    onChange(value);
  };

  return (
    <FormControl
      fullWidth
      error={Boolean(rawErrors?.length) || Boolean(error)}
    >
      <InputLabel>Target EC2</InputLabel>

      <Select
        value={selectedInstance}
        onChange={event =>
          handleChange(String(event.target.value))
        }
        disabled={loading || Boolean(error)}
      >
        {instances.map(instance => (
          <MenuItem
            key={instance.instanceId}
            value={instance.instanceId}
          >
            {instance.name} ({instance.instanceId})
          </MenuItem>
        ))}
      </Select>

      {loading && (
        <FormHelperText>
          <CircularProgress size={14} /> Loading EC2 instances...
        </FormHelperText>
      )}

      {error && (
        <FormHelperText>
          {error}
        </FormHelperText>
      )}
    </FormControl>
  );
};
