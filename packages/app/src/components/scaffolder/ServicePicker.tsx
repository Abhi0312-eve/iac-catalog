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

interface ServiceDefinition {
  name: string;
  title: string;
  description: string;
}

export const ServicePicker = ({
  onChange,
  rawErrors,
  formData,
  formContext,
}: FieldExtensionComponentProps<string>) => {
  const configurationVersion =
    formContext?.formData?.configurationVersion;

  const [services, setServices] = useState<ServiceDefinition[]>(
    [],
  );
  const [selectedService, setSelectedService] = useState(
    formData ?? '',
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadServices = async () => {
      if (!configurationVersion) {
        setServices([]);
        setSelectedService('');
        onChange('');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');

        const response = await fetch(
          `/api/aws/server-config/services?version=${encodeURIComponent(
            configurationVersion,
          )}`,
        );

        if (!response.ok) {
          throw new Error(
            'Failed to load server configuration services',
          );
        }

        const data = await response.json();

        const discoveredServices: ServiceDefinition[] =
          data.services ?? [];

        setServices(discoveredServices);

        const currentServiceExists =
          formData &&
          discoveredServices.some(
            service => service.name === formData,
          );

        if (!currentServiceExists) {
          setSelectedService('');
          onChange('');
        } else {
          setSelectedService(formData);
        }
      } catch (err) {
        console.error(
          'Failed to load server configuration services:',
          err,
        );

        setServices([]);
        setSelectedService('');
        setError('Unable to load services');
        onChange('');
      } finally {
        setLoading(false);
      }
    };

    loadServices();
  }, [configurationVersion, formData, onChange]);

  useEffect(() => {
    if (formData !== undefined) {
      setSelectedService(formData);
    }
  }, [formData]);

  const handleChange = (value: string) => {
    setSelectedService(value);
    onChange(value);
  };

  return (
    <FormControl
      fullWidth
      error={Boolean(rawErrors?.length) || Boolean(error)}
    >
      <InputLabel>Service</InputLabel>

      <Select
        value={selectedService}
        onChange={event =>
          handleChange(String(event.target.value))
        }
        disabled={
          loading ||
          Boolean(error) ||
          !configurationVersion
        }
      >
        {services.map(service => (
          <MenuItem
            key={service.name}
            value={service.name}
          >
            {service.title}
          </MenuItem>
        ))}
      </Select>

      {loading && (
        <FormHelperText>
          <CircularProgress size={14} /> Loading services...
        </FormHelperText>
      )}

      {!loading && !configurationVersion && (
        <FormHelperText>
          Select a configuration version first.
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
