import React, { useState } from 'react'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Menu from './pages/Menu.jsx'
import Lobby from './pages/Lobby.jsx'
import Game from './pages/Game.jsx'

export default function App(){
  const [route, setRoute] = useState('login') // 'login' | 'register' | 'menu' | 'lobby' | 'game'
  const [token, setToken] = useState(null)
  const [user, setUser] = useState(null)
  const [players, setPlayers] = useState([])

  function handleLogout(){
    setToken(null); setUser(null); setRoute('login')
  }

  return (
    <div style={{ fontFamily:'system-ui, sans-serif', maxWidth: 960, margin:'0 auto', padding:16 }}>
      {route === 'login' && <Login onLogin={(t,u)=>{ setToken(t); setUser(u); setRoute('menu') }} goRegister={()=>setRoute('register')} />}
      {route === 'register' && <Register goLogin={()=>setRoute('login')} />}
      {route === 'menu' && <Menu user={user} onStart={()=>setRoute('lobby')} onLogout={handleLogout} />}
      {route === 'lobby' && <Lobby onStart={(p)=>{ setPlayers(p); setRoute('game') }} onBack={()=>setRoute('menu')} />}
      {route === 'game' && <Game players={players} onExit={()=>setRoute('menu')} token={token} />}
    </div>
  )
}
