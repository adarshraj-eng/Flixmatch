export default function LoadingScreen({ message = 'Loading...' }) {
  return (
    <div className="loading-screen">
      <div className="loading-logo">
        Flick<span>Match</span>
      </div>
      <div className="loading-spinner">
        <div className="spinner-ring" />
      </div>
      <p className="loading-message">{message}</p>
    </div>
  )
}
