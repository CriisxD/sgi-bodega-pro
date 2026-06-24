export function HormibalLogo({ className = '', withText = true }: { className?: string, withText?: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <img src="/logo.png" alt="Hormibal Logo" className={withText ? "w-full max-w-[120px] object-contain drop-shadow-md" : "w-full h-full object-contain drop-shadow-md"} style={{ mixBlendMode: 'multiply' }} />
      {withText && (
        <div className="flex flex-col items-center mt-2 text-center">
          <span className="font-extrabold text-[22px] tracking-[0.2em] text-[#808080] leading-none">
            HORMIBAL
          </span>
          <span className="font-normal text-[8px] tracking-[0.15em] text-[#666666] mt-1">
            PREFABRICADOS DE HORMIGÓN
          </span>
        </div>
      )}
    </div>
  );
}
