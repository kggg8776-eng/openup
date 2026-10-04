import { useAuth } from './context/AuthContext'
import { Lobby } from './components/Lobby'
import { CallScreen } from './components/CallScreen'

function App() {
  const { token } = useAuth()
  return token ? <CallScreen /> : <Lobby />
}

export default App
