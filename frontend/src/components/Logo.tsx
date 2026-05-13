interface Props {
  size?: number;
  className?: string;
}

/**
 * Whalebase Logo：鲸鱼尾巴跃出水面 + 数据柱状图基座
 * 单色版本(深蓝 + 琥珀)。可缩放任意大小。
 */
export function Logo({ size = 32, className = '' }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Whalebase logo"
    >
      {/* 鲸鱼尾巴 */}
      <path
        d="M32 22 C25 14, 18 6, 8 -4 C5 -7, 10 -9, 14 -7 C22 -1, 28 5, 31 12 C34 5, 40 -1, 48 -7 C52 -9, 57 -7, 54 -4 C44 6, 37 14, 32 22 Z"
        transform="translate(0, 18)"
        fill="#1e3a8a"
      />
      {/* 数据柱 */}
      <rect x="11" y="46" width="6" height="11" rx="1" fill="#fbbf24" />
      <rect x="19" y="42" width="6" height="15" rx="1" fill="#fbbf24" />
      <rect x="27" y="38" width="6" height="19" rx="1" fill="#fbbf24" />
      <rect x="35" y="40" width="6" height="17" rx="1" fill="#fbbf24" />
      <rect x="43" y="44" width="6" height="13" rx="1" fill="#fbbf24" />
    </svg>
  );
}

/** 简化版,只画一个鲸鱼尾巴(给小图标场景比如 favicon)。 */
export function LogoMark({ size = 32, className = '' }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Whalebase"
    >
      <rect width="32" height="32" rx="7" fill="#1e3a8a" />
      <path
        d="M16 22 C12 16, 8 11, 4 6 C3 5, 5 4, 7 5 C11 9, 14 13, 15.5 16 C17 13, 20 9, 24 5 C26 4, 28 5, 27 6 C23 11, 19 16, 16 22 Z"
        fill="#fbbf24"
      />
    </svg>
  );
}
