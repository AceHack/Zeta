import * as React from "react";
import { GripVerticalIcon } from "lucide-react";
import * as ResizablePrimitive from "react-resizable-panels";

import { cn } from "@/lib/utils";

/**
 * react-resizable-panels v4 renamed the primitives and changed the DOM contract this
 * file styles against. Both halves matter, and only the first is a type error:
 *
 *   `PanelGroup`         -> `Group`      (v4 exports no `PanelGroup`)
 *   `PanelResizeHandle`  -> `Separator`  (v4 exports no `PanelResizeHandle`)
 *
 * The second half is silent. v3 stamped `data-panel-group-direction` on the group and
 * inherited it down to the handle; v4 emits `data-group` / `data-panel` / `data-separator`
 * and NO direction attribute anywhere. Direction now reaches the DOM two ways: the group
 * applies `flex-direction` through an inline style, and the separator carries
 * `aria-orientation` — which is the INVERSE of the group's orientation (a horizontal
 * group has vertical separators). So every `data-[panel-group-direction=vertical]:*`
 * selector below became a selector that can never match, and the correct v4 spelling on
 * the separator is `aria-[orientation=horizontal]:*`. This mirrors upstream shadcn/ui's
 * own v4 migration of this same vendored file.
 *
 * The group's direction class is dropped rather than translated: `Group` destructures
 * `orientation` out of its props, so it reaches neither the DOM nor an `aria-*`
 * attribute, and v4 sets `display:flex` + `flex-direction` inline regardless. A class
 * that cannot match is not styling, it is decoration that reads as styling.
 */
function ResizablePanelGroup({
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.Group>) {
  return (
    <ResizablePrimitive.Group
      data-slot="resizable-panel-group"
      className={cn("flex h-full w-full", className)}
      {...props}
    />
  );
}

function ResizablePanel({
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.Panel>) {
  return <ResizablePrimitive.Panel data-slot="resizable-panel" {...props} />;
}

function ResizableHandle({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.Separator> & {
  withHandle?: boolean;
}) {
  return (
    <ResizablePrimitive.Separator
      data-slot="resizable-handle"
      className={cn(
        "bg-border focus-visible:ring-ring relative flex w-px items-center justify-center after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:after:left-0 aria-[orientation=horizontal]:after:h-1 aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:translate-x-0 aria-[orientation=horizontal]:after:-translate-y-1/2 [&[aria-orientation=horizontal]>div]:rotate-90",
        className
      )}
      {...props}
    >
      {withHandle && (
        <div className="bg-border z-10 flex h-4 w-3 items-center justify-center rounded-xs border">
          <GripVerticalIcon className="size-2.5" />
        </div>
      )}
    </ResizablePrimitive.Separator>
  );
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
