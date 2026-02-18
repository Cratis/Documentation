import React from 'react';

export interface ButtonProps {
  label: string;
  onClick?: () => void;
  primary?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export const Button: React.FC<ButtonProps> = ({
  label,
  onClick,
  primary = false,
  size = 'medium',
}) => {
  const sizeStyles = {
    small: { padding: '8px 16px', fontSize: '12px' },
    medium: { padding: '12px 24px', fontSize: '14px' },
    large: { padding: '16px 32px', fontSize: '16px' },
  };

  const baseStyle = {
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
    ...sizeStyles[size],
    backgroundColor: primary ? '#007bff' : '#6c757d',
    color: 'white',
  };

  return (
    <button style={baseStyle} onClick={onClick}>
      {label}
    </button>
  );
};
