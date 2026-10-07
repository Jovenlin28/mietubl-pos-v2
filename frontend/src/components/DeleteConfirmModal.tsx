import React from "react";
import {
  Box,
  Typography,
  Button,
  Stack,
  Modal,
  IconButton,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

interface DeleteConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
}) => {
  return (
    <Modal open={open} onClose={onClose}>
      <Box
        sx={{
          width: 400,
          bgcolor: "background.paper",
          borderRadius: 2,
          boxShadow: 24,
          p: 4,
          mx: "auto",
          mt: 12,
          outline: "none",
          textAlign: "center",
        }}
      >
        <IconButton
          sx={{
            bgcolor: "#ffeaea",
            color: "#e74c3c",
            mb: 2,
            width: 56,
            height: 56,
            borderRadius: "50%",
          }}
          disableRipple
        >
          <DeleteIcon sx={{ fontSize: 32 }} />
        </IconButton>
        <Typography variant="h6" fontWeight={700} mb={2}>
          {title}
        </Typography>
        <Typography variant="body1" mb={3}>
          {message}
        </Typography>
        <Stack direction="row" spacing={2} justifyContent="center">
          <Button
            variant="contained"
            sx={{ bgcolor: "#0a2342", color: "#fff", boxShadow: 0 }}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            sx={{ bgcolor: "#f39c12", color: "#fff", boxShadow: 0 }}
            onClick={onConfirm}
          >
            Yes Delete
          </Button>
        </Stack>
      </Box>
    </Modal>
  );
};

export default DeleteConfirmModal;