import { useEffect, useState } from 'react';
import {
  TextField,
  FormControl,
  FormHelperText,
} from '@material-ui/core';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';

interface ModuleVersion {
  version: string;
  supportsStorage: boolean;
}

export const ModuleStorageSizePicker = ({
  onChange,
  rawErrors,
  formData,
  formContext,
}: FieldExtensionComponentProps<number>) => {
  const [supportsStorage, setSupportsStorage] = useState(false);
  const [loading, setLoading] = useState(true);

  const moduleVersion =
    formContext?.formData?.moduleVersion;

  useEffect(() => {
    if (!moduleVersion) {
      setSupportsStorage(false);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadModuleCapability = async () => {
      setLoading(true);

      try {
        const response = await fetch(
          '/api/aws/module-versions',
        );

        if (!response.ok) {
          throw new Error(
            `Module version request failed: ${response.status}`,
          );
        }

        const data = await response.json();

        const selectedModule = (
          data.versions ?? []
        ).find(
          (module: ModuleVersion) =>
            module.version === moduleVersion,
        );

        if (!cancelled) {
          setSupportsStorage(
            selectedModule?.supportsStorage === true,
          );
        }
      } catch (error) {
        console.error(
          'Failed to load module capability:',
          error,
        );

        if (!cancelled) {
          setSupportsStorage(false);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadModuleCapability();

    return () => {
      cancelled = true;
    };
  }, [moduleVersion]);

  if (loading || !supportsStorage) {
    return null;
  }

  return (
    <FormControl fullWidth error={Boolean(rawErrors?.length)}>
      <TextField
        label="Storage Size (GB)"
        type="number"
        value={formData ?? 20}
        inputProps={{
          min: 1,
        }}
        onChange={event =>
          onChange(Number(event.target.value))
        }
      />

      {rawErrors?.length ? (
        <FormHelperText>
          {rawErrors[0]}
        </FormHelperText>
      ) : null}
    </FormControl>
  );
};
