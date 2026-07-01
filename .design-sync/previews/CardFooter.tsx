import { Button, Card, CardContent, CardFooter } from "zeta-portal-web";

export const InCard = () => (
  <div className="bg-background p-6 text-foreground">
    <Card className="w-96">
      <CardContent className="pt-6 text-sm text-muted-foreground">
        Delete this environment? Volumes and DNS records are retained for 7 days.
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button variant="ghost" size="sm">
          Cancel
        </Button>
        <Button variant="destructive" size="sm">
          Delete environment
        </Button>
      </CardFooter>
    </Card>
  </div>
);
