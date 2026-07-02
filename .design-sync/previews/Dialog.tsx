import * as React from "react";
import { Button, Dialog, DialogBody, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label } from "zeta-portal-web";

export const Open = () => (
  <Dialog open onClose={() => {}}>
    <DialogHeader>
      <DialogTitle>Deploy blueprint</DialogTitle>
      <DialogDescription>postgres · stateful · expose: cluster</DialogDescription>
    </DialogHeader>
    <DialogBody className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="dep-name">Deployment name</Label>
        <Input id="dep-name" placeholder="postgres-primary" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="dep-ns">Namespace</Label>
        <Input id="dep-ns" defaultValue="zeta-data" />
      </div>
    </DialogBody>
    <DialogFooter>
      <Button variant="ghost">Cancel</Button>
      <Button variant="success">Deploy</Button>
    </DialogFooter>
  </Dialog>
);
