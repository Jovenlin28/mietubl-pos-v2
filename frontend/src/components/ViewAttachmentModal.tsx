import React from "react";
import { Dialog, DialogTitle, DialogContent, IconButton, Box, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

interface ViewAttachmentModalProps {
  open: boolean;
  onClose: () => void;
  // support both prop names for callers
  attachmentUrl?: string | null;
  url?: string | null;
}

const ViewAttachmentModal: React.FC<ViewAttachmentModalProps> = ({ open, onClose, attachmentUrl, url }) => {
  const src = url ?? attachmentUrl ?? null;
  const isImage = src ? /\.(jpg|jpeg|png|webp|gif|jfif)$/i.test(src) : false;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 600, fontSize: 18 }}>
        Attachment Preview
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 300 }}>
          {src ? (
            isImage ? (
              <img
                src={src}
                alt="Attachment"
                style={{ maxWidth: "100%", maxHeight: "70vh", borderRadius: 8, boxShadow: "0 2px 8px #0002" }}
              />
            ) : (
              // embed other filetypes directly when possible (PDFs, etc.)
              <Box sx={{ width: "100%" }}>
                <Box component="iframe" src={src} sx={{ width: "100%", height: "70vh", border: 0 }} />
              </Box>
            )
          ) : (
            <Typography color="text.secondary">No attachment available</Typography>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default ViewAttachmentModal;