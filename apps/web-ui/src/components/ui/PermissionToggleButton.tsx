import { Button } from "./Button";

type PermissionToggleButtonProps = {
  enabled: boolean;
  onClick?: () => void;
  disabled?: boolean;
};

export function PermissionToggleButton({ enabled, onClick, disabled = false }: PermissionToggleButtonProps) {
  return (
    <Button
      size="sm"
      variant={enabled ? "primary" : "outline"}
      onClick={onClick ?? (() => {})}
      disabled={disabled}
    >
      {enabled ? "On" : "Off"}
    </Button>
  );
}
