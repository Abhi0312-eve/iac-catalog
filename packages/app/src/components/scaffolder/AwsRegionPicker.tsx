import { useEffect, useState } from 'react';
import {
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@material-ui/core';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';

export const AwsRegionPicker = ({
  onChange,
  rawErrors,
  formData,
}: FieldExtensionComponentProps<string>) => {
  console.log('### AWS REGION PICKER LOADED ###', formData);
  const [selectedRegion, setSelectedRegion] = useState(formData ?? '');

  useEffect(() => {
    if (formData !== undefined) {
      setSelectedRegion(formData);
    }
  }, [formData]);

  const regions = ['us-east-2', 'us-east-1', 'ap-south-1'];

  const handleChange = (value: string) => {
    console.log('### AWS REGION HANDLE CHANGE ###', value);
    console.log('[AwsRegionPicker] selected:', value);

    setSelectedRegion(value);
    onChange(value);
  };

  return (
    <FormControl
      fullWidth
      error={Boolean(rawErrors?.length)}
    >
      <InputLabel>AWS Region</InputLabel>

      <Select
        value={selectedRegion}
        onChange={event =>
          handleChange(String(event.target.value))
        }
      >
        {regions.map(region => (
          <MenuItem key={region} value={region}>
            {region}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};
