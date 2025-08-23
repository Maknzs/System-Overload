import React, { useState } from 'react'

export default function Lobby({ onStart, onBack }){
  const [names, setNames] = useState(['',''])

  function addPlayer(){ if(names.length<5) setNames([...names, '']) }
  function removePlayer(i){ if(names.length>2) setNames(names.filter((_,idx)=>idx!==i)) }
  function update(i,v){ const copy=[...names]; copy[i]=v; setNames(copy) }

  function start(){ const players = names.filter(Boolean).map((n,i)=>({ id: String(i+1), name:n })); if(players.length>=2) onStart(players) }

  return (
    <div>
      <h2>Local Lobby</h2>
      {names.map((n,i)=>(
        <div key={i} style={{ marginBottom: 6 }}>
          <input placeholder={`Player ${i+1} name`} value={n} onChange={e=>update(i,e.target.value)} />
          {i>=2 && <button onClick={()=>removePlayer(i)} style={{ marginLeft: 6 }}>Remove</button>}
        </div>
      ))}
      <div style={{ marginTop: 8 }}>
        <button onClick={addPlayer} disabled={names.length>=5}>Add Player</button>
      </div>
      <div style={{ marginTop: 12 }}>
        <button onClick={start}>Start Game</button>
        <button onClick={onBack} style={{ marginLeft: 8 }}>Back</button>
      </div>
    </div>
  )
}
