import { useEffect, useState } from 'react';
import {
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  FormHelperText,
} from '@material-ui/core';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';

interface ModuleVersion {
  version: string;
  supportsStorage: boolean;
}

export const ModuleVersionPicker = ({
  onChange,
  rawErrors,
  formData,
  formContext,
}: FieldExtensionComponentProps<string>) => {
  const [versions, setVersions] = useState<ModuleVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState(formData ?? '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadVersions = async () => {
      try {
        const response = await fetch('/api/aws/module-versions');

        if (!response.ok) {
          throw new Error('Failed to load module versions');
        }

        const data = await response.json();

        const discoveredVersions: ModuleVersion[] =
          data.versions ?? [];

        setVersions(discoveredVersions);

        if (!formData && data.latest) {
          setSelectedVersion(data.latest);
          onChange(data.latest);
        }
      } catch (err) {
        console.error(
          'Failed to load AWS EC2 module versions:',
          err,
        );

        setError('Unable to load module versions');
      } finally {
        setLoading(false);
      }
    };

    loadVersions();
  }, [formData, onChange]);

  useEffect(() => {
    if (formData !== undefined) {
      setSelectedVersion(formData);
    }
  }, [formData]);

  const handleChange = (value: string) => {
    setSelectedVersion(value);
    onChange(value);

    const selectedModule = versions.find(
      module => module.version === value,
    );

    if (selectedModule && formContext?.formData) {
      formContext.formData.moduleSupportsStorage =
        selectedModule.supportsStorage;
    }
  };

  return (
    <FormControl
      fullWidth
      error={Boolean(rawErrors?.length) || Boolean(error)}
    >
      <InputLabel>Module Version</InputLabel>

      <Select
        value={selectedVersion}
        onChange={event =>
          handleChange(String(event.target.value))
        }
        disabled={loading || Boolean(error)}
      >
        {versions.map(module => (
          <MenuItem
            key={module.version}
            value={module.version}
          >
            {module.version}
          </MenuItem>
        ))}
      </Select>

      {loading && (
        <FormHelperText>
          <CircularProgress size={14} /> Loading module versions...
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
