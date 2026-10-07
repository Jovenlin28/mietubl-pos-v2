import React from "react";
import { Button, ButtonProps } from "@mui/material";

interface CancelButtonProps extends ButtonProps {
  textBtn?: string;
}

const CancelButton: React.FC<CancelButtonProps> = ({ textBtn = "CANCEL", ...props }) => (
  <Button
    variant="contained"
    sx={{
      bgcolor: "#0a2342",
      color: "#fff",
      fontWeight: 700,
      borderRadius: 2,
      boxShadow: 0,
      "&:hover": { bgcolor: "#12213A" },
    }}
    {...props}
  >
    {textBtn}
  </Button>
);

export default CancelButton;