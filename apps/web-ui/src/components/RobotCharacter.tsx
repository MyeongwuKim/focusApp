import { useId } from "react";

type RobotCharacterProps = {
  className?: string;
  ariaLabel?: string;
  showAlertBadge?: boolean;
  badgeText?: "!" | "?";
  mood?: "neutral" | "sad";
};

export function RobotCharacter({
  className,
  ariaLabel = "로봇 캐릭터",
  showAlertBadge = false,
  badgeText,
  mood = "neutral",
}: RobotCharacterProps) {
  const isSad = mood === "sad";
  const gradientIdSeed = useId().replace(/:/g, "");
  const shellGradId = `shell-grad-${gradientIdSeed}`;
  const faceGradId = `face-grad-${gradientIdSeed}`;
  const eyeGradId = `eye-grad-${gradientIdSeed}`;

  return (
    <svg viewBox="0 0 160 160" role="img" aria-label={ariaLabel} className={className}>
      <defs>
        <linearGradient id={shellGradId} x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#F8FAFC" />
          <stop offset="100%" stopColor="#D1D5DB" />
        </linearGradient>
        <linearGradient id={faceGradId} x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#374151" />
          <stop offset="100%" stopColor="#1F2937" />
        </linearGradient>
        <radialGradient id={eyeGradId} cx="45%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#A5F3FC" />
          <stop offset="100%" stopColor="#22D3EE" />
        </radialGradient>
      </defs>

      <line x1="54" y1="34" x2="54" y2="52" stroke="#6B7280" strokeWidth="3" strokeLinecap="round" />
      <line x1="106" y1="34" x2="106" y2="52" stroke="#6B7280" strokeWidth="3" strokeLinecap="round" />
      <circle cx="54" cy="30" r="6.5" fill="#E5E7EB" stroke="#4B5563" strokeWidth="2" />
      <circle cx="106" cy="30" r="6.5" fill="#E5E7EB" stroke="#4B5563" strokeWidth="2" />
      <circle cx="54" cy="52" r="3.2" fill="#D1D5DB" stroke="#6B7280" strokeWidth="1.6" />
      <circle cx="106" cy="52" r="3.2" fill="#D1D5DB" stroke="#6B7280" strokeWidth="1.6" />

      <ellipse cx="80" cy="86" rx="55" ry="42" fill={`url(#${shellGradId})`} stroke="#9CA3AF" strokeWidth="2.2" />
      <path
        d="M38 74c8-14 24-22 43-22"
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.65"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <rect x="42" y="60" width="76" height="44" rx="17" fill={`url(#${faceGradId})`} />

      {isSad ? (
        <>
          <path d="M56 74l9 1.5" stroke="#E5E7EB" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M104 74l-9 1.5" stroke="#E5E7EB" strokeWidth="2.6" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M56 72l8 3" stroke="#E5E7EB" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M104 72l-8 3" stroke="#E5E7EB" strokeWidth="2.6" strokeLinecap="round" />
        </>
      )}

      <ellipse cx="63" cy="82" rx="7.2" ry={isSad ? 5.2 : 6.4} fill={`url(#${eyeGradId})`} opacity={isSad ? 0.9 : 1} />
      <ellipse cx="97" cy="82" rx="7.2" ry={isSad ? 5.2 : 6.4} fill={`url(#${eyeGradId})`} opacity={isSad ? 0.9 : 1} />
      <circle cx="65" cy="80" r="2" fill="#ECFEFF" opacity={isSad ? 0.75 : 1} />
      <circle cx="99" cy="80" r="2" fill="#ECFEFF" opacity={isSad ? 0.75 : 1} />

      {isSad ? (
        <>
          <path
            d="M66 97c4-2.2 24-2.2 28 0"
            fill="none"
            stroke="#67E8F9"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <path
          d="M66 96l4-2.2 4 2.2 4-2.2 4 2.2 4-2.2 4 2.2 4-2.2"
          fill="none"
          stroke="#67E8F9"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {showAlertBadge || badgeText ? (
        <>
          <circle cx="124" cy="42" r="11" fill={badgeText === "?" ? "#60A5FA" : "#F59E0B"} />
          <text x="124" y="46" textAnchor="middle" fontSize="13" fontWeight="700" fill="#111827">
            {badgeText ?? "!"}
          </text>
        </>
      ) : null}
    </svg>
  );
}
