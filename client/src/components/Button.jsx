import clsx from 'clsx'
import styles from './Button.module.css'

export default function Button({
  as = 'button',
  variant = 'secondary',
  size = 'md',
  loading = false,
  className,
  disabled,
  ...props
}) {
  const Component = as
  return (
    <Component
      className={clsx(
        styles.btn,
        styles[variant],
        styles[size],
        loading && styles.loading,
        className,
      )}
      disabled={disabled ?? loading}
      {...props}
    />
  )
}
