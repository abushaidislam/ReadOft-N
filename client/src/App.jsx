import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import Navbar from './components/Navbar'
import Subnav from './components/Subnav.jsx'
import Footer from './components/Footer.jsx'
import Loader from './components/Loader.jsx'
import ProtectedRoute from './routes/ProtectedRoute'
import { useAuth } from './state/AuthContext.jsx'

const Home = lazy(() => import('./pages/Home'))
const Categories = lazy(() => import('./pages/Categories'))
const Category = lazy(() => import('./pages/Category'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.jsx'))
const ResetPassword = lazy(() => import('./pages/ResetPassword.jsx'))
const Preview = lazy(() => import('./pages/Preview.jsx'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Editor = lazy(() => import('./pages/Editor'))
const Profile = lazy(() => import('./pages/Profile'))
const Article = lazy(() => import('./pages/Article'))
const Admin = lazy(() => import('./pages/Admin'))
const AdminCategories = lazy(() => import('./pages/AdminCategories.jsx'))
const Feed = lazy(() => import('./pages/Feed'))
const Author = lazy(() => import('./pages/Author'))

function GlobalUI() {
  const { ui } = useAuth()
  return (
    <>
      {ui.busy && (
        <div className="global-loader" role="status" aria-live="polite">
          <div className="spinner" />
          <span className="sr-only">Loading…</span>
        </div>
      )}
      <div className="toast-wrap">
        {ui.toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`} onClick={() => ui.dismiss(t.id)}>
            {t.message}
          </div>
        ))}
      </div>
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <Navbar />
        <Subnav />
        <GlobalUI />
        <main className="app-main">
          <Suspense fallback={<Loader />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/register" element={<Register />} />
              <Route path="/categories" element={<Categories />} />
              <Route path="/category/:slug" element={<Category />} />
              <Route path="/article/:id" element={<Article />} />
              <Route path="/a/:slug" element={<Article />} />
              <Route path="/p/:token" element={<Preview />} />
              <Route path="/author/:id" element={<Author />} />
              <Route element={<ProtectedRoute roles={["reader","author","admin"]} />}>
                <Route path="/feed" element={<Feed />} />
              </Route>
              <Route element={<ProtectedRoute roles={["author","admin"]} />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/editor/:id?" element={<Editor />} />
              </Route>
              <Route element={<ProtectedRoute roles={["reader","author","admin"]} />}>
                <Route path="/profile" element={<Profile />} />
              </Route>
              <Route element={<ProtectedRoute roles={["admin"]} />}>
                <Route path="/admin" element={<Admin />} />
                <Route path="/admin/categories" element={<AdminCategories />} />
              </Route>
            </Routes>
          </Suspense>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  )
}

export default App
