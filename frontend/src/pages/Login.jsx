import React, { useState } from 'react'
import { api } from '../api'

export default function Login({ onLogin, goRegister }){
  const [emailOrUsername, setId] = useState('')
  const [password, setPw] = useState('')
  const [err, setErr] = useState(null)

  async function submit(e){
    e.preventDefault()
    setErr(null)
    try{
      const { token, user } = await api('/auth/login', { method:'POST', body:{ emailOrUsername, password } })
      onLogin(token, user)
    }catch(e){ setErr(e.message) }
  }

  return (
    <div>
      <h1>System Overload</h1>
      <h2>Login</h2>
      <form onSubmit={submit}>
        <div><input placeholder="Email or Username" value={emailOrUsername} onChange={e=>setId(e.target.value)} /></div>
        <div><input type="password" placeholder="Password" value={password} onChange={e=>setPw(e.target.value)} /></div>
        <button type="submit">Login</button>
        <button type="button" onClick={goRegister} style={{ marginLeft: 8 }}>Register</button>
      </form>
      {err && <p style={{ color:'crimson' }}>{err}</p>}
    </div>
  )
}
