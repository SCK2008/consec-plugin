import React from 'react';
import SvgIcon, { SvgIconProps } from '@material-ui/core/SvgIcon';

/**
 * ConSec mark, copied from the ConSec favicon: a coral shield around the
 * three layers of a container image, on the same white tile.
 */
export const ConsecLogo = (props: SvgIconProps) => (
  <SvgIcon viewBox="0 0 64 64" {...props}>
    <rect width="64" height="64" rx="14" fill="#fff" />
    <g transform="translate(9 7) scale(0.46)">
      <path
        d="M50 4 L90 18 V50 C90 74 72 91 50 99 C28 91 10 74 10 50 V18 Z"
        fill="none"
        stroke="#FF5A4D"
        strokeWidth="9"
        strokeLinejoin="round"
      />
      <rect x="29" y="31.5" width="42" height="11" rx="3" fill="#052140" />
      <rect x="29" y="46.5" width="42" height="11" rx="3" fill="#052140" />
      <rect x="29" y="61.5" width="42" height="11" rx="3" fill="#052140" />
    </g>
  </SvgIcon>
);
