import { useEffect, useState } from 'react';
import {
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@material-ui/core';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';

export const AwsInstanceTypePicker = ({
  onChange,
  rawErrors,
  formData,
  formContext,
}: FieldExtensionComponentProps<string>) => {
  const [instanceTypes, setInstanceTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const region = formContext?.formData?.region;

  useEffect(() => {
    if (!region) {
      setInstanceTypes([]);
      return;
    }

    let cancelled = false;

    const loadInstanceTypes = async () => {
      setLoading(true);

      try {
        const response = await fetch(
          `/api/aws/instance-types?region=${encodeURIComponent(region)}`,
        );

        if (!response.ok) {
          throw new Error(
            `AWS instance types request failed: ${response.status}`,
          );
        }

        const data = await response.json();

        if (!cancelled) {
          setInstanceTypes(data.instanceTypes ?? []);
        }
      } catch (error) {
        console.error('Failed to load AWS instance types:', error);

        if (!cancelled) {
          setInstanceTypes([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadInstanceTypes();

    return () => {
      cancelled = true;
    };
  }, [region]);

  return (
    <FormControl fullWidth error={Boolean(rawErrors?.length)}>
      <InputLabel>Instance Type</InputLabel>

      <Select
        value={formData ?? ''}
        disabled={!region || loading}
        onChange={event => onChange(event.target.value as string)}
      >
        {instanceTypes.map(instanceType => (
          <MenuItem key={instanceType} value={instanceType}>
            {instanceType}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};
