import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Button } from "./controls/Button";
import { popupClass } from "./controls/cx";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  action: string;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({ open, title, message, action, onConfirm, onClose }: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-black/30 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <AlertDialog.Popup className={popupClass("fixed top-1/2 left-1/2 z-50 flex w-80 -translate-x-1/2 -translate-y-1/2 flex-col gap-2 p-4")}>
          <AlertDialog.Title className="text-tx">{title}</AlertDialog.Title>
          <AlertDialog.Description className="text-tx-2">{message}</AlertDialog.Description>
          <div className="mt-2 flex justify-end gap-1.5">
            <AlertDialog.Close render={<Button variant="ghost" />}>Cancel</AlertDialog.Close>
            <Button
              variant="solid"
              onClick={() => {
                onConfirm();
                onClose();
              }}
            >
              {action}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
