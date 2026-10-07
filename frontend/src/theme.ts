import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  breakpoints: {
    // xs must be 0. Make 'sm' start at 800px so "xs" styles apply below 800px.
    values: {
      xs: 0,
      sm: 850,
      md: 1280,
      lg: 1440,
      xl: 1920,
    },
  },
});

export default theme;