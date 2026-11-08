// Layout shell only. Each panel is filled by a later stage (see docs/PLAN.md).
export function App() {
  return (
    <div className="layout">
      <header className="banner">FleetPulse</header>
      <main className="map-panel">Map (Stage 4)</main>
      <aside className="side-panel">
        <section>Trucks (Stage 4)</section>
        <section>Routes (Stage 5)</section>
        <section>Dispatchers (Stage 6)</section>
      </aside>
      <section className="detail-panel">Truck detail (Stage 7)</section>
    </div>
  );
}
