export function HormibalLogo({ className = '', withText = true }: { className?: string, withText?: boolean }) {
  return (
    <svg viewBox="0 0 200 220" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Back cube faces */}
      <path d="M100 20 L160 55 L160 125 L100 160 L40 125 L40 55 Z" fill="#2B2B2B" opacity="0.1"/>
      
      {/* Left face - Yellow */}
      <path d="M40 55 L100 90 L100 160 L40 125 Z" fill="#D4D916"/>
      
      {/* Right face - Cyan */}
      <path d="M160 55 L100 90 L100 160 L160 125 Z" fill="#00B4D8"/>
      
      {/* Top face - Light */}
      <path d="M40 55 L100 20 L160 55 L100 90 Z" fill="#E8E850"/>
      
      {/* Inner H cutout - Left vertical */}
      <path d="M60 68 L80 80 L80 110 L60 98 Z" fill="#1a1a2e"/>
      {/* Inner H cutout - Right vertical */}
      <path d="M120 80 L140 68 L140 98 L120 110 Z" fill="#1a1a2e"/>
      {/* Inner H cutout - Crossbar */}
      <path d="M80 88 L120 88 L120 98 L80 98 Z" fill="#1a1a2e"/>
      
      {/* Top small yellow block */}
      <path d="M60 35 L80 23 L100 35 L80 47 Z" fill="#D4D916"/>
      {/* Top small cyan block */}
      <path d="M100 35 L120 23 L140 35 L120 47 Z" fill="#00B4D8"/>
      
      {withText && (
        <>
          <text x="100" y="190" textAnchor="middle" fontFamily="var(--font-sans)" fontWeight="800" fontSize="26" letterSpacing="3" fill="#808080">
            HORMIBAL
          </text>
          <text x="100" y="210" textAnchor="middle" fontFamily="var(--font-sans)" fontWeight="400" fontSize="10" letterSpacing="2" fill="#666666">
            PREFABRICADOS DE HORMIGÓN
          </text>
        </>
      )}
    </svg>
  );
}
