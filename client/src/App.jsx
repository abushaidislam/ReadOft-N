import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
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

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/category/:slug" element={<Category />} />
        <Route path="/article/:id" element={<Article />} />
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
