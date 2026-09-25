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

interface ConfigurationVersion {
  version: string;
}

export const ServerConfigVersionPicker = ({
  onChange,
  rawErrors,
  formData,
}: FieldExtensionComponentProps<string>) => {
  const [versions, setVersions] = useState<ConfigurationVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState(
    formData ?? '',
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadVersions = async () => {
      try {
        const response = await fetch(
          '/api/aws/server-config/versions',
        );

        if (!response.ok) {
          throw new Error(
            'Failed to load server configuration versions',
          );
        }

        const data = await response.json();

        const discoveredVersions: ConfigurationVersion[] =
          data.versions ?? [];

        setVersions(discoveredVersions);

        if (!formData && data.latest) {
          setSelectedVersion(data.latest);
          onChange(data.latest);
        }
      } catch (err) {
        console.error(
          'Failed to load server configuration versions:',
          err,
        );

        setError(
          'Unable to load server configuration versions',
        );
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
  };

  return (
    <FormControl
      fullWidth
      error={Boolean(rawErrors?.length) || Boolean(error)}
    >
      <InputLabel>Configuration Version</InputLabel>

      <Select
        value={selectedVersion}
        onChange={event =>
          handleChange(String(event.target.value))
        }
        disabled={loading || Boolean(error)}
      >
        {versions.map(version => (
          <MenuItem
            key={version.version}
            value={version.version}
          >
            {version.version}
          </MenuItem>
        ))}
      </Select>

      {loading && (
        <FormHelperText>
          <CircularProgress size={14} /> Loading configuration
          versions...
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
