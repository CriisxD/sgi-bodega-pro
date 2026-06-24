export function HormibalLogo({ className = '', withText = true }: { className?: string, withText?: boolean }) {
  return (
    <svg viewBox="0 0 200 230" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Left half - Yellow */}
      <path d="M40 60 L70 43 L70 83 L100 66 L100 106 L70 123 L70 163 L40 180 Z" fill="#D4D916"/>
      
      {/* Right half - Cyan */}
      <path d="M160 60 L160 180 L130 163 L130 123 L100 106 L100 66 L130 83 L130 43 Z" fill="#00B4D8"/>
      
      {/* Floating Top Diamond - Yellow */}
      <path d="M100 9 L130 26 L100 43 L70 26 Z" fill="#D4D916"/>

      {withText && (
        <>
          <text x="100" y="205" textAnchor="middle" fontFamily="var(--font-sans)" fontWeight="800" fontSize="24" letterSpacing="3" fill="#808080">
            HORMIBAL
          </text>
          <text x="100" y="222" textAnchor="middle" fontFamily="var(--font-sans)" fontWeight="400" fontSize="9" letterSpacing="2" fill="#666666">
            PREFABRICADOS DE HORMIGÓN
          </text>
        </>
      )}
    </svg>
  );
}
