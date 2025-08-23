import React, { useState } from 'react'
import { api } from '../api'

export default function Register({ goLogin }){
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPw] = useState('')
  const [ok, setOk] = useState(false)
  const [err, setErr] = useState(null)

  async function submit(e){
    e.preventDefault()
    setErr(null)
    try{
      await api('/auth/register', { method:'POST', body:{ email, username, password } })
      setOk(true)
    }catch(e){ setErr(e.message) }
  }

  return (
    <div>
      <h2>Create Account</h2>
      <form onSubmit={submit}>
        <div><input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} /></div>
        <div><input placeholder="Username" value={username} onChange={e=>setUsername(e.target.value)} /></div>
        <div><input type="password" placeholder="Password" value={password} onChange={e=>setPw(e.target.value)} /></div>
        <button type="submit">Register</button>
        <button type="button" onClick={goLogin} style={{ marginLeft: 8 }}>Back to Login</button>
      </form>
      {ok && <p>Account created! You can now log in.</p>}
      {err && <p style={{ color:'crimson' }}>{err}</p>}
    </div>
  )
}
