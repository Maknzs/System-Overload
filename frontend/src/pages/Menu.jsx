import React from 'react'

export default function Menu({ user, onStart, onLogout }){
  return (
    <div>
      <h2>Welcome, {user?.username}</h2>
      <p>Email: {user?.email}</p>
      <p>Games Played: {user?.gamesPlayed ?? 0}</p>
      <div style={{ marginTop: 12 }}>
        <button onClick={onStart}>Start New Game</button>
        <button onClick={onLogout} style={{ marginLeft: 8 }}>Logout</button>
      </div>
    </div>
  )
}
