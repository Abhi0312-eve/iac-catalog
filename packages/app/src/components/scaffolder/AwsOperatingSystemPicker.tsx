import { useEffect, useState } from 'react';
import {
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@material-ui/core';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';

interface Ami {
  id: string;
  name: string;
  originalName?: string;
  creationDate?: string;
}

export const AwsOperatingSystemPicker = ({
  onChange,
  rawErrors,
  formData,
  formContext,
}: FieldExtensionComponentProps<string>) => {
  const [amis, setAmis] = useState<Ami[]>([]);
  const [loading, setLoading] = useState(false);

  const region = formContext?.formData?.region;

  useEffect(() => {
    if (!region) {
      setAmis([]);
      return;
    }

    let cancelled = false;

    const loadAmis = async () => {
      setLoading(true);

      try {
        const response = await fetch(
          `/api/aws/amis?region=${encodeURIComponent(region)}`,
        );

        if (!response.ok) {
          throw new Error(
            `AWS AMI request failed: ${response.status}`,
          );
        }

        const data = await response.json();

        if (!cancelled) {
          setAmis(data.amis ?? []);
        }
      } catch (error) {
        console.error('Failed to load AWS AMIs:', error);

        if (!cancelled) {
          setAmis([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadAmis();

    return () => {
      cancelled = true;
    };
  }, [region]);

  return (
    <FormControl
      fullWidth
      error={Boolean(rawErrors?.length)}
    >
      <InputLabel>Operating System</InputLabel>

      <Select
        value={formData ?? ''}
        disabled={!region || loading}
        onChange={event =>
          onChange(String(event.target.value))
        }
      >
        {amis.map(ami => (
          <MenuItem key={ami.id} value={ami.id}>
            {ami.name}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};
