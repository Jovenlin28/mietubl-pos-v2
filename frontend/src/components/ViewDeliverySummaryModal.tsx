import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Stack,
  Typography,
  Avatar,
  useTheme,
  IconButton,
  Stepper,
  Step,
  StepLabel,
  StepConnector,
  stepConnectorClasses,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import { styled } from '@mui/material/styles';

interface Props {
  open: boolean;
  onClose: () => void;
  delivery: any | null;
}

const stepOrder = [
  { key: 'processed', label: 'Processed', dateField: 'processedDate', attachmentField: 'processedAttachment', icon: Inventory2Icon },
  { key: 'pickedUp', label: 'Picked Up', dateField: 'pickedUpDate', attachmentField: 'pickedUpAttachment', icon: LocalShippingIcon },
  { key: 'delivered', label: 'Delivered', dateField: 'deliveredDate', attachmentField: 'deliveredAttachment', icon: CheckIcon },
];

export default function ViewDeliverySummaryModal({ open, onClose, delivery }: Props) {
  const theme = useTheme();

  const isStepCompleted = (stepKey: string) => {
    switch (stepKey) {
      case 'processed':
        return !!delivery?.processedDate;
      case 'pickedUp':
        return !!delivery?.pickedUpDate;
      case 'delivered':
        return !!delivery?.deliveredDate;
      default:
        return false;
    }
  };

  // uniform thumbnail size
  const thumbWidth = 240;
  // --- Stepper customization ---
  const ColorlibConnector = styled(StepConnector)(({ theme }) => ({
    [`&.${stepConnectorClasses.alternativeLabel}`]: {
      top: 22,
    },
    [`& .${stepConnectorClasses.line}`]: {
      height: 3,
      border: 0,
      backgroundColor: '#bdbdbd',
      borderRadius: 1,
    },
    [`&.${stepConnectorClasses.active} .${stepConnectorClasses.line}`]: {
      backgroundColor: '#f39c12',
    },
    [`&.${stepConnectorClasses.completed} .${stepConnectorClasses.line}`]: {
      backgroundColor: '#f39c12',
    },
  }));

  function StepIcon(props: { active: boolean; completed: boolean; icon: number | string }) {
    const { completed } = props;
    const idx = Number(props.icon) - 1;
    const IconComp: any = stepOrder[idx].icon;
    return (
      <Avatar sx={{ bgcolor: completed ? '#f39c12' : '#bdbdbd', width: 56, height: 56 }}>
        <IconComp />
      </Avatar>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant='h4' fontWeight={600} fontSize={18}>Delivery Summary</Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ width: '100%', mb: 2 }}>
          <Stepper alternativeLabel activeStep={-1} connector={<ColorlibConnector />}>
            {stepOrder.map((s, idx) => {
              const completed = isStepCompleted(s.key);
              return (
                <Step key={s.key} completed={completed}>
                  <StepLabel StepIconComponent={(p) => <StepIcon {...p} icon={idx + 1} />}>{s.label}</StepLabel>
                </Step>
              );
            })}
          </Stepper>

          {/* Dates and thumbnails aligned under each step */}
          <Box sx={{ display: 'flex', gap: 4, mt: 2 }}>
            {stepOrder.map((s) => {
              const completed = isStepCompleted(s.key);
              return (
                <Box key={s.key} sx={{ flex: 1, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {delivery?.[s.dateField] ? new Date(delivery[s.dateField]).toLocaleString() : '—'}
                  </Typography>
                  {delivery?.[s.attachmentField] ? (
                    <Box sx={{ width: thumbWidth, height: 140, mx: 'auto', overflow: 'hidden', borderRadius: 2 }}>
                      <img src={delivery[s.attachmentField]} alt={`${s.label} attachment`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </Box>
                  ) : (
                    <Typography variant="caption" color="text.secondary">No attachment</Typography>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>

        <Box sx={{ mt: 3 }}>
          <Typography variant="body2"><strong>PO Number:</strong> {delivery?.purchaseOrderNumber || '—'}</Typography>
          <Typography variant="body2"><strong>Method:</strong> {delivery?.method || '—'}</Typography>
          <Typography variant="body2"><strong>Created On:</strong> {delivery?.createdOn ? new Date(delivery.createdOn).toLocaleString() : '—'}</Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ color: '#000' }}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
