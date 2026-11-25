import type React from "react";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={"skeleton rounded-md " + (className ?? "")} {...props} />
  );
}

export { Skeleton };
