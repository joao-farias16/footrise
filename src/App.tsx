import { useGame } from './state/GameContext';
import { ConflictDialog, Notice } from './ui/CloudWidgets';
import { AccountScreen } from './ui/screens/AccountScreen';
import { CardScreen } from './ui/screens/CardScreen';
import { ClubChoiceScreen } from './ui/screens/ClubChoiceScreen';
import { CreateScreen } from './ui/screens/CreateScreen';
import { DraftScreen } from './ui/screens/DraftScreen';
import { EventScreen } from './ui/screens/EventScreen';
import { HistoryScreen } from './ui/screens/HistoryScreen';
import { HomeScreen } from './ui/screens/HomeScreen';
import { HubScreen } from './ui/screens/HubScreen';
import { LegacyScreen } from './ui/screens/LegacyScreen';
import { OffersScreen } from './ui/screens/OffersScreen';
import { SeasonReviewScreen } from './ui/screens/SeasonReviewScreen';

function GameScreen() {
  const { career } = useGame();
  if (!career) return <HomeScreen />;
  switch (career.phase) {
    case 'draft':
      return <DraftScreen career={career} />;
    case 'card':
      return <CardScreen career={career} />;
    case 'club-choice':
      return <ClubChoiceScreen career={career} />;
    case 'hub':
      return <HubScreen career={career} />;
    case 'event':
      return <EventScreen career={career} />;
    case 'season-review':
      return <SeasonReviewScreen career={career} />;
    case 'offers':
      return <OffersScreen career={career} />;
    case 'retired':
      return <LegacyScreen career={career} />;
    default:
      return <HomeScreen />;
  }
}

export function App() {
  const { screen, history, historyId } = useGame();
  const historyItem = history.find((h) => h.summary.careerId === historyId);
  return (
    <div className="app">
      {screen === 'home' && <HomeScreen />}
      {screen === 'create' && <CreateScreen />}
      {screen === 'game' && <GameScreen />}
      {screen === 'history' && <HistoryScreen />}
      {screen === 'history-detail' && (historyItem ? <LegacyScreen summary={historyItem.summary} /> : <HistoryScreen />)}
      {screen === 'account' && <AccountScreen />}
      <ConflictDialog />
      <Notice />
    </div>
  );
}
