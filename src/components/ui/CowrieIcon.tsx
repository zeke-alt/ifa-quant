const CowrieIcon = ({ size = 24, color = "currentColor" }: { size?: number; color?: string }) => {
  const s = size / 24;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="12" cy="12" rx="10" ry="7" stroke="oklch(0.55 0.2 250)" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M4 12.5 Q8 10 12 10 Q16 10 20 12.5 Q16 15 12 15 Q8 15 4 12.5 Z" fill="oklch(0.55 0.2 250)"/>
      <path d="M5.5 12.5 L6 10.5 L7.5 12.5 M9 12.5 L9.5 10.5 L11 12.5 M13 12.5 L13.5 10.5 L15 12.5 M16.5 12.5 L17 10.5 L18.5 12.5"
        stroke="oklch(0.55 0.2 250)" strokeWidth="0.8" fill="none" strokeLinecap="round"/>
      <path d="M4 9.5 Q12 6 20 9.5" stroke={color} strokeWidth="1" fill="none" strokeLinecap="round"/>
    </svg>
  );
};

export default CowrieIcon;