type AssistantState = "idle" | "analyzing" | "ready" | "warning";

type AssistantBotProps = {
  state: AssistantState;
};

export default function AssistantBot({ state }: AssistantBotProps) {
  return (
    <div className={`assistant-bot assistant-bot--${state}`} aria-hidden="true">
      <svg viewBox="0 0 240 240" role="presentation">
        <defs>
          <linearGradient id="botGlow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#89f7fe" />
            <stop offset="100%" stopColor="#49b8ff" />
          </linearGradient>
        </defs>

        <circle className="assistant-bot__halo" cx="120" cy="120" r="88" />
        <circle className="assistant-bot__ring" cx="120" cy="120" r="74" />

        <g className="assistant-bot__antenna">
          <rect x="116" y="30" width="8" height="24" rx="4" />
          <circle cx="120" cy="24" r="8" />
        </g>

        <ellipse className="assistant-bot__shadow" cx="120" cy="202" rx="58" ry="14" />

        <g className="assistant-bot__body">
          <rect className="assistant-bot__shell" x="60" y="62" width="120" height="98" rx="32" />
          <rect className="assistant-bot__screen" x="81" y="84" width="78" height="52" rx="16" />
          <rect className="assistant-bot__chin" x="92" y="156" width="56" height="18" rx="9" />
          <circle className="assistant-bot__thruster" cx="88" cy="174" r="7" />
          <circle className="assistant-bot__thruster" cx="152" cy="174" r="7" />

          <g className="assistant-bot__face assistant-bot__face--idle">
            <circle cx="103" cy="108" r="6" />
            <circle cx="137" cy="108" r="6" />
            <path d="M102 123c4 6 12 9 18 9s14-3 18-9" />
          </g>

          <g className="assistant-bot__face assistant-bot__face--analyzing">
            <rect x="94" y="99" width="52" height="6" rx="3" />
            <rect x="94" y="112" width="32" height="6" rx="3" />
            <rect x="94" y="125" width="42" height="6" rx="3" />
          </g>

          <g className="assistant-bot__face assistant-bot__face--ready">
            <circle cx="103" cy="108" r="6" />
            <circle cx="137" cy="108" r="6" />
            <path d="M98 121c6 9 16 13 22 13s16-4 22-13" />
          </g>

          <g className="assistant-bot__face assistant-bot__face--warning">
            <path d="M111 95h18l12 24h-42l12-24z" />
            <rect x="117" y="102" width="6" height="10" rx="3" />
            <circle cx="120" cy="117" r="3" />
          </g>
        </g>
      </svg>
    </div>
  );
}
