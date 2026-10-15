import { StyleSheet } from 'react-native';

const regular = {
  width: 44,
  height: 44,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

const compact = {
  width: 44,
  height: 44,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

export const actionIconStyles = StyleSheet.create({
  add: {
    ...regular,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  addCompact: {
    ...compact,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  edit: { ...regular, borderWidth: 0, backgroundColor: 'transparent' },
  editCompact: { ...compact, borderWidth: 0, backgroundColor: 'transparent' },
  delete: { ...regular, borderWidth: 0, backgroundColor: 'transparent' },
  deleteCompact: {
    ...compact,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
});
