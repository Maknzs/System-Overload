import "./Menu.css";

export default function Menu({ user, onStart, onStartBot, onLogout }) {
  return (
    <div className="page menu-page">
      <div className="menu-header">
        <h1 className="page-header">System Overload</h1>
        <span className="badge">Local</span>
      </div>

      <div className="card user-card" style={{ marginBottom: 16 }}>
        <div>
          <strong>Username:</strong> {user?.username}
        </div>
        <div>
          <strong>Email:</strong> {user?.email}
        </div>
        <div>
          <strong>Games played:</strong> {user?.gamesPlayed ?? 0}
        </div>
      </div>

      <div className="actions">
        <button className="btn btn-accent" onClick={onStart}>
          Start Hotseat Game
        </button>
        <button className="btn btn-accent" onClick={onStartBot}>
          Play vs ML Bot
        </button>
        <button className="btn btn-ghost" onClick={onLogout}>
          Logout
        </button>
      </div>
    </div>
  );
}

// return (
//   <div style={{ padding: 16 }}>
//     <h2>Welcome{user?.username ? `, ${user.username}` : ""}</h2>
//     {user?.email && <p>Email: {user.email}</p>}
//     <p>Games Played: {user?.gamesPlayed ?? 0}</p>

//     <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
//       <button type="button" onClick={() => nav("/lobby")}>
//         Start New Game
//       </button>

//       {/* If you have auth wired up, call your logout API first, then nav("/") or "/login" */}
//       <button
//         type="button"
//         onClick={() => nav("/login")}
//         style={{ marginLeft: 8 }}
//       >
//         Logout
//       </button>
//     </div>
//   </div>
// );
