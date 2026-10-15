import { forwardRef } from 'react';
import {
  TextInput as NativeTextInput,
  type TextInputProps,
} from 'react-native';

export const AppTextInput = forwardRef<NativeTextInput, TextInputProps>(
  function AppTextInput(props, ref) {
    return <NativeTextInput ref={ref} autoCapitalize="sentences" {...props} />;
  },
);
