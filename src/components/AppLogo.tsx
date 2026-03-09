interface AppLogoProps {
  logoUrl?: string | null;
  alt?: string;
  className?: string;
}

const DEFAULT_LOGO = "/logo.png";

/** Logo de empresa o logo por defecto */
const AppLogo = ({ logoUrl, alt = "Logo", className = "" }: AppLogoProps) => (
  <img
    src={logoUrl || DEFAULT_LOGO}
    alt={alt}
    className={className}
    onError={(e) => {
      const target = e.target as HTMLImageElement;
      if (target.src !== DEFAULT_LOGO) target.src = DEFAULT_LOGO;
    }}
  />
);

export default AppLogo;
