import React, { useState } from 'react'
import { api } from '../api'

// Minimal placeholder for the hotseat game loop.
export default function Game({ players, onExit, token }){
  const [active, setActive] = useState(0)
  const [winner, setWinner] = useState(null)

  function nextTurn(){
    setActive((active+1) % players.length)
  }

  async function endGame(i){
    setWinner(players[i])
    try{
      await api('/account/games-played', { method:'POST', token })
    }catch(e){ console.error('Failed to increment gamesPlayed:', e.message) }
  }

  if(!players?.length) return <div>No players. <button onClick={onExit}>Exit</button></div>

  return (
    <div>
      <h2>System Overload — Hotseat</h2>
      {!winner ? (
        <div>
          <p>Current turn: <strong>{players[active].name}</strong></p>
          <div style={{ marginTop: 8 }}>
            <button onClick={nextTurn}>Simulate Turn →</button>
            <button onClick={()=>endGame(active)} style={{ marginLeft: 8 }}>End Game (Declare Winner)</button>
          </div>
          <ul style={{ marginTop: 16 }}>
            {players.map((p,i)=>(<li key={p.id}>{p.name}</li>))}
          </ul>
        </div>
      ) : (
        <div>
          <h3>Winner: {winner.name}</h3>
          <button onClick={onExit}>Back to Menu</button>
        </div>
      )}
    </div>
  )
}
