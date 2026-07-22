import Image from "next/image";

export function BrandLogo({
  className = "",
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/taskflow-logo-v2.png"
      alt="TaskFlow"
      width={681}
      height={342}
      priority={priority}
      className={`object-contain ${className}`}
    />
  );
}
