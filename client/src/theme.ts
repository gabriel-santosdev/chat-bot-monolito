import { createTheme } from '@mantine/core';

// Tema global do Mantine. Ajustes finos de layout ficam nos arquivos .scss (padrão BEM).
export const theme = createTheme({
  primaryColor: 'violet',
  primaryShade: { light: 6, dark: 5 },
  defaultRadius: 'md',
  fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  headings: {
    fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    fontWeight: '700',
  },
  cursorType: 'pointer',
});
