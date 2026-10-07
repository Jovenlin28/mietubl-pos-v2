import React, { ReactNode } from "react";
import { Button, ButtonProps } from "@mui/material";

interface PrimaryButtonProps extends ButtonProps {
  textBtn: string | ReactNode;
}

const PrimaryButton: React.FC<PrimaryButtonProps> = ({ textBtn, ...props }) => (
  <Button
    variant="contained"
    sx={{
      bgcolor: "#f39c12",
      color: "#fff",
      fontWeight: 700,
      px: 2,
      boxShadow: 0,
      "&:hover": { bgcolor: "#f4b000" },
    }}
    {...props}
  >
    {textBtn}
  </Button>
);

export default PrimaryButton;