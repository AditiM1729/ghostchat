/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Link } from 'react-router-dom';

interface ButtonProps {
  label: string;
  isLarge?: boolean;
  className?: string;
  onClick?: () => void;
  href?: string;
  labelClassName?: string;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  isLarge = false,
  className = '',
  onClick,
  href = '/start',
  labelClassName = '',
}) => {
  const content = (
    <>
      <span className={`btn-label ${labelClassName}`}>{label}</span>
      <span className="dot" aria-hidden="true">
        <svg
          width={isLarge ? 16 : 12}
          height={isLarge ? 16 : 12}
          viewBox="0 0 12 12"
          fill="none"
        >
          <path
            d="M4.5 2.5 8 6l-3.5 3.5"
            stroke="#0b1d3a"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </>
  );

  const classes = `btn ${isLarge ? 'lg' : ''} ${className}`.trim();

  return (
    <Link to={href} className={classes} onClick={onClick}>
      {content}
    </Link>
  );
};
