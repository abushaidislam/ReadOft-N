import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'

// Google Icon Component
const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="google-icon" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s12-5.373 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-2.641-.21-5.236-.611-7.743z" />
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.022 35.026 44 30.038 44 24c0-2.641-.21-5.236-.611-7.743z" />
  </svg>
)

// Eye Icons for password toggle
const EyeIcon = () => (
  <svg className="eye-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
)

const EyeOffIcon = () => (
  <svg className="eye-off-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
  </svg>
)

// Testimonial Component
const TestimonialCard = ({ testimonial, delay }) => (
  <div className="testimonial-card" style={{ animationDelay: delay }}>
    <img src={testimonial.avatarSrc} className="testimonial-avatar" alt="avatar" />
    <div className="testimonial-content">
      <div className="testimonial-name">{testimonial.name}</div>
      <div className="testimonial-handle">{testimonial.handle}</div>
      <div className="testimonial-text">{testimonial.text}</div>
    </div>
  </div>
)

export default function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const nav = useNavigate()

  const testimonials = [
    {
      avatarSrc: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face",
      name: "Sarah Chen",
      handle: "@sarahdigital",
      text: "Amazing platform! The user experience is seamless and the features are exactly what I needed."
    },
    {
      avatarSrc: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
      name: "Marcus Johnson",
      handle: "@marcustech", 
      text: "This service has transformed how I work. Clean design, powerful features, and excellent support."
    },
    {
      avatarSrc: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
      name: "David Martinez",
      handle: "@davidcreates",
      text: "I've tried many platforms, but this one stands out. Intuitive, reliable, and genuinely helpful."
    }
  ]

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await login(email, password)
      nav('/')
    } catch (e) {
      setError(e.message)
    }
  }

  const handleGoogleSignIn = () => {
    // Placeholder for Google OAuth
    alert('Google Sign-In coming soon!')
  }

  return (
    <div className="signin-container">
      {/* Left column: sign-in form */}
      <section className="signin-form-section">
        <div className="signin-form-wrapper">
          <h1 className="signin-title">Welcome</h1>
          <p className="signin-description">Access your account and continue your journey with us</p>

          <form className="signin-form" onSubmit={onSubmit}>
            <div>
              <label className="glass-input-label">Email Address</label>
              <div className="glass-input-wrapper">
                <input 
                  name="email" 
                  type="email" 
                  placeholder="Enter your email address" 
                  className="glass-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="glass-input-label">Password</label>
              <div className="glass-input-wrapper">
                <div className="password-wrapper">
                  <input 
                    name="password" 
                    type={showPassword ? 'text' : 'password'} 
                    placeholder="Enter your password" 
                    className="glass-input" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={{ paddingRight: '48px' }}
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)} 
                    className="password-toggle"
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            <div className="signin-options">
              <label className="remember-me">
                <input 
                  type="checkbox" 
                  name="rememberMe" 
                  className="custom-checkbox" 
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Keep me signed in</span>
              </label>
              <Link to="/forgot-password" className="reset-password">Reset password</Link>
            </div>

            <button type="submit" className="signin-btn">
              Sign In
            </button>
          </form>

          <div className="divider">
            <span className="divider-text">Or continue with</span>
          </div>

          <button onClick={handleGoogleSignIn} className="google-btn">
            <GoogleIcon />
            Continue with Google
          </button>

          <p className="signin-footer">
            New to our platform? <Link to="/register">Create Account</Link>
          </p>
        </div>
      </section>

      {/* Right column: hero image + testimonials */}
      <section className="signin-hero-section">
        <div className="signin-hero-bg"></div>
        <div className="testimonials-container">
          <TestimonialCard testimonial={testimonials[0]} delay="1s" />
          <div className="hidden xl:flex">
            <TestimonialCard testimonial={testimonials[1]} delay="1.2s" />
          </div>
          <div className="hidden 2xl:flex">
            <TestimonialCard testimonial={testimonials[2]} delay="1.4s" />
          </div>
        </div>
      </section>
    </div>
  )
}
