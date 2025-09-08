import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Subnav from './components/Subnav.jsx'
import Home from './pages/Home'
import Categories from './pages/Categories'
import Category from './pages/Category'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Editor from './pages/Editor'
import Profile from './pages/Profile'
import Article from './pages/Article'
import Admin from './pages/Admin'
import ProtectedRoute from './routes/ProtectedRoute'
import Feed from './pages/Feed'
import Author from './pages/Author'
import { useAuth } from './state/AuthContext.jsx'

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
      <Navbar />
      <Subnav />
      <GlobalUI />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/category/:slug" element={<Category />} />
        <Route path="/article/:id" element={<Article />} />
        <Route path="/a/:slug" element={<Article />} />
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
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
