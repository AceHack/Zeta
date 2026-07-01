import {
  Button,
  Dialog,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "zeta-portal-web";

// Dialog is a fixed-position portal — rendered open, in a single full-card cell
// (cfg.overrides.Dialog: cardMode single + viewport).
export const CreateResource = () => (
  <div className="min-h-[500px] bg-background text-foreground">
    <Dialog open onClose={() => {}}>
      <DialogHeader>
        <DialogTitle>Create database</DialogTitle>
        <DialogDescription>Provision a managed Postgres on the shared cluster.</DialogDescription>
      </DialogHeader>
      <DialogBody className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="db-name">Name</Label>
          <Input id="db-name" placeholder="rooms-postgres" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="db-size">Storage</Label>
          <Input id="db-size" defaultValue="20 GiB" />
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost">Cancel</Button>
        <Button>Create</Button>
      </DialogFooter>
    </Dialog>
  </div>
);
