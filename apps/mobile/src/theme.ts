import { MD3DarkTheme } from 'react-native-paper'

export const theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    background: '#060913',
    surface: '#0c1322',
    surfaceVariant: '#162036',
    primary: '#14b8a6', // Teal brand primary
    onPrimary: '#ffffff',
    secondary: '#2dd4bf',
    onSecondary: '#060913',
    tertiary: '#38bdf8',
    error: '#f43f5e', // Coral brand debt color
    onError: '#ffffff',
    outline: '#1e293b',
    outlineVariant: '#334155',
    elevation: {
      level0: 'transparent',
      level1: '#0c1322',
      level2: '#111b30',
      level3: '#162036',
      level4: '#1c2844',
      level5: '#223052',
    },
  },
}
