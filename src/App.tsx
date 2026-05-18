import "./App.css";

function App() {
  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="SkillRun sections">
        <div className="brand">
          <span className="brand-mark">SR</span>
          <div>
            <h1>SkillRun</h1>
            <p>Desktop Alpha</p>
          </div>
        </div>
        <nav>
          <a className="active" href="#status">Status</a>
          <a href="#switchboard">Switchboard</a>
          <a href="#mount">Mount</a>
          <a href="#runs">Runs</a>
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Local consumer control plane</p>
            <h2>Core status and capsule controls</h2>
          </div>
          <button type="button">Refresh</button>
        </header>

        <section id="status" className="status-grid" aria-label="Desktop alpha status">
          <article>
            <span className="label">Core</span>
            <strong>Not checked</strong>
            <p>Host handshake will be wired through the Core runner in T002.</p>
          </article>
          <article>
            <span className="label">Exposure</span>
            <strong>No tools exposed</strong>
            <p>Imported capsules stay disabled until the user enables them.</p>
          </article>
          <article>
            <span className="label">Mount</span>
            <strong>Plan required</strong>
            <p>Mount apply and rollback are dashboard confirmation flows.</p>
          </article>
        </section>
      </section>
    </main>
  );
}

export default App;
