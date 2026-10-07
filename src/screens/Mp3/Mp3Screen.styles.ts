import { StyleSheet } from 'react-native';
import { colors, typography } from '../../theme';

export const styles = StyleSheet.create({
  header: { gap: 12 },
  empty: {
    flex: 1,
    minHeight: 340,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  disc: {
    width: 168,
    height: 168,
    borderRadius: 84,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  innerDisc: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 1,
    borderColor: '#65856A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  description: { ...typography.body, textAlign: 'center' },
  footer: { ...typography.small, textAlign: 'center', paddingBottom: 16 },
});
