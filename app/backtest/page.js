export default function BacktestPage() {
  return (
    <div style={{ width: "100vw", height: "100vh", margin: 0, padding: 0, overflow: "hidden" }}>
      <iframe
        src="https://qaisalraifai.github.io/backtest-qta/"
        style={{ width: "100%", height: "100%", border: "none" }}
        allow="fullscreen"
      />
    </div>
  );
}
