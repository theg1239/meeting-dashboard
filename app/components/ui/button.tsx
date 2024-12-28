import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'ghost' | 'destructive' | 'primary' | 'secondary'
}

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  className = '',
  ...props
}) => {
  const variantClasses =
    variant === 'ghost'
      ? 'text-white hover:text-gray-300 bg-transparent'
      : variant === 'destructive'
      ? 'bg-red-600 hover:bg-red-700 text-white'
      : 'bg-blue-600 hover:bg-blue-700 text-white'

  return (
    <button
      {...props}
      className={`${variantClasses} ${className} px-4 py-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
    />
  )
}

export default Button
