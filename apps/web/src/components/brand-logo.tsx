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
      src="/codeforge-logo.svg"
      alt="CodeForge Systems"
      width={500}
      height={400}
      priority={priority}
      className={`object-contain ${className}`}
    />
  );
}
