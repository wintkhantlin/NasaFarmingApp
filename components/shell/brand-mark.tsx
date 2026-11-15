import Image from "next/image";

/** The Green Ally satellite-and-field emblem. */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <Image
      src="/project-logo.png"
      width={size}
      height={size}
      sizes={`${size}px`}
      alt=""
      aria-hidden="true"
      className="shrink-0 rounded-[24%]"
    />
  );
}
